// 홈랜드 자동 플레이 테스트 시스템
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_SCENARIOS = [
  {
    name: '신규 유저 (Lv1-5)',
    startLevel: 1,
    targetLevel: 5,
    expectedTime: 15, // 분
    funTarget: 9 // 10점 만점
  },
  {
    name: '초보 유저 (Lv5-15)',
    startLevel: 5,
    targetLevel: 15,
    expectedTime: 30,
    funTarget: 8
  },
  {
    name: '중급 유저 (Lv15-30)',
    startLevel: 15,
    targetLevel: 30,
    expectedTime: 60,
    funTarget: 7
  }
];

class AutoPlayTester {
  constructor(userId, scenario) {
    this.userId = userId;
    this.scenario = scenario;
    this.stats = {
      hunts: 0,
      levelUps: 0,
      goldEarned: 0,
      deaths: 0,
      itemsBought: 0,
      timeSpent: 0
    };
    this.issues = [];
    this.character = null;
  }

  async initialize() {
    // 기존 캐릭터 삭제
    const existing = await prisma.character.findFirst({ 
      where: { userId: this.userId } 
    });
    
    if (existing) {
      await prisma.character.delete({ where: { id: existing.id } });
    }

    // 새 캐릭터 생성
    this.character = await prisma.character.create({
      data: {
        userId: this.userId,
        name: `테스트봇_${Date.now()}`,
        class: 'warrior',
        level: this.scenario.startLevel,
        xp: 0,
        maxHp: 100 + (this.scenario.startLevel - 1) * 10,
        hp: 100 + (this.scenario.startLevel - 1) * 10,
        maxMana: 40,
        mana: 40,
        attack: 10 + (this.scenario.startLevel - 1) * 2,
        defense: 5 + (this.scenario.startLevel - 1) * 1,
        gold: 100 * this.scenario.startLevel
      }
    });

    console.log(`✅ 캐릭터 생성: Lv${this.character.level} ${this.character.name}`);
  }

  async hunt() {
    const char = await prisma.character.findUnique({ 
      where: { id: this.character.id } 
    });

    // 전투 시뮬레이션
    const expGain = Math.floor(Math.random() * 30) + 20;
    const goldGain = Math.floor(Math.random() * 20) + 10;
    
    // 레벨에 따른 경험치 요구량 (Phase 1 공식)
    let expNeeded = 50 + (char.level - 1) * 25;
    if (char.level >= 10 && char.level < 30) {
      expNeeded = Math.floor(expNeeded / 1.3); // 1.3배 빠른 성장
    }

    const newXp = char.xp + expGain;
    let updates = { xp: newXp, gold: char.gold + goldGain };
    
    // 레벨업 체크
    if (newXp >= expNeeded) {
      updates.level = char.level + 1;
      updates.xp = newXp - expNeeded;
      updates.maxHp = char.maxHp + 10;
      updates.hp = char.maxHp + 10;
      updates.attack = char.attack + 2;
      updates.defense = char.defense + 1;
      
      this.stats.levelUps++;
      console.log(`   🎉 레벨업! Lv${char.level} → Lv${updates.level}`);
    }

    await prisma.character.update({ 
      where: { id: this.character.id }, 
      data: updates 
    });

    this.stats.hunts++;
    this.stats.goldEarned += goldGain;

    return updates.level || char.level;
  }

  async buyItem() {
    const char = await prisma.character.findUnique({ 
      where: { id: this.character.id } 
    });

    if (char.gold >= 50) {
      // 체력 포션 구매
      await prisma.consumable.upsert({
        where: {
          characterId_type_effect: {
            characterId: this.character.id,
            type: 'potion',
            effect: 'heal_hp'
          }
        },
        create: {
          characterId: this.character.id,
          name: '체력 포션',
          type: 'potion',
          effect: 'heal_hp',
          power: 50,
          quantity: 1
        },
        update: {
          quantity: { increment: 1 }
        }
      });

      await prisma.character.update({
        where: { id: this.character.id },
        data: { gold: char.gold - 50 }
      });

      this.stats.itemsBought++;
      this.stats.goldEarned -= 50;
      return true;
    }
    return false;
  }

  async run() {
    const startTime = Date.now();
    console.log(`\n🎮 시나리오 시작: ${this.scenario.name}`);
    console.log(`   목표: Lv${this.scenario.startLevel} → Lv${this.scenario.targetLevel}`);
    console.log(`   예상 시간: ${this.scenario.expectedTime}분\n`);

    await this.initialize();

    let currentLevel = this.scenario.startLevel;
    let huntsWithoutLevelUp = 0;

    // 목표 레벨까지 사냥
    while (currentLevel < this.scenario.targetLevel) {
      const newLevel = await this.hunt();
      
      if (newLevel > currentLevel) {
        huntsWithoutLevelUp = 0;
        currentLevel = newLevel;
      } else {
        huntsWithoutLevelUp++;
      }

      // 너무 오래 걸리면 문제 리포트
      if (huntsWithoutLevelUp > 20) {
        this.issues.push({
          type: 'slow_progression',
          level: currentLevel,
          hunts: huntsWithoutLevelUp,
          message: `Lv${currentLevel}에서 20회 이상 사냥해도 레벨업 안됨`
        });
        huntsWithoutLevelUp = 0;
      }

      // 10회마다 아이템 구매 시도
      if (this.stats.hunts % 10 === 0) {
        await this.buyItem();
      }
    }

    this.stats.timeSpent = (Date.now() - startTime) / 1000; // 초

    return this.generateReport();
  }

  generateReport() {
    const finalChar = this.character;
    
    // 재미 점수 계산 (0-10)
    let funScore = 10;
    
    // 레벨업 속도 (빠를수록 높은 점수)
    const huntsPerLevel = this.stats.hunts / this.stats.levelUps;
    if (huntsPerLevel > 15) funScore -= 2; // 너무 느림
    if (huntsPerLevel > 20) funScore -= 1;
    
    // 골드 획득량 (적절한지 체크)
    const goldPerHunt = this.stats.goldEarned / this.stats.hunts;
    if (goldPerHunt < 10) funScore -= 1; // 골드 부족
    
    // 이슈 발생
    funScore -= this.issues.length * 0.5;

    funScore = Math.max(0, Math.min(10, funScore));

    return {
      scenario: this.scenario.name,
      passed: funScore >= this.scenario.funTarget,
      funScore,
      funTarget: this.scenario.funTarget,
      stats: this.stats,
      issues: this.issues,
      metrics: {
        huntsPerLevel: huntsPerLevel.toFixed(1),
        goldPerHunt: goldPerHunt.toFixed(1),
        actualTime: (this.stats.timeSpent / 60).toFixed(1) + '분',
        expectedTime: this.scenario.expectedTime + '분'
      }
    };
  }
}

async function runAllTests() {
  console.log('🤖 홈랜드 자동 플레이 테스트 시작');
  console.log('='.repeat(60));

  const results = [];
  const testUserId = 'autotest_' + Date.now();

  // User 생성
  await prisma.user.upsert({
    where: { discordId: testUserId },
    update: {},
    create: { discordId: testUserId, username: '자동테스트봇' }
  });

  for (const scenario of TEST_SCENARIOS) {
    try {
      const tester = new AutoPlayTester(testUserId, scenario);
      const result = await tester.run();
      results.push(result);
      
      console.log(`\n📊 결과: ${result.passed ? '✅ 통과' : '❌ 실패'}`);
      console.log(`   재미 점수: ${result.funScore.toFixed(1)}/${result.funTarget} 점`);
      console.log(`   사냥 횟수: ${result.stats.hunts}회`);
      console.log(`   레벨업: ${result.stats.levelUps}회`);
      console.log(`   골드 획득: ${result.stats.goldEarned}`);
      console.log(`   아이템 구매: ${result.stats.itemsBought}개`);
      console.log(`   사냥당 레벨업: ${result.metrics.huntsPerLevel}회`);
      console.log(`   사냥당 골드: ${result.metrics.goldPerHunt}`);
      
      if (result.issues.length > 0) {
        console.log(`\n   ⚠️  발견된 문제:`);
        result.issues.forEach(issue => {
          console.log(`      - ${issue.message}`);
        });
      }

    } catch (error) {
      console.error(`\n❌ 테스트 실패: ${scenario.name}`);
      console.error(error.message);
      results.push({
        scenario: scenario.name,
        passed: false,
        error: error.message
      });
    }
  }

  // 최종 리포트
  console.log('\n' + '='.repeat(60));
  console.log('📋 최종 테스트 결과');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\n통과율: ${passed}/${total} (${((passed/total)*100).toFixed(0)}%)`);
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const score = result.funScore ? `${result.funScore.toFixed(1)}점` : 'N/A';
    console.log(`${status} ${result.scenario}: ${score}`);
  });

  // 종합 의견
  console.log('\n💡 개선 제안:');
  
  const avgFunScore = results
    .filter(r => r.funScore)
    .reduce((sum, r) => sum + r.funScore, 0) / results.filter(r => r.funScore).length;
  
  if (avgFunScore < 7) {
    console.log('   - 전반적으로 재미가 부족합니다. 레벨업 속도나 보상 개선 필요');
  } else if (avgFunScore >= 8) {
    console.log('   - 재미 점수 우수! Phase 1 목표 달성');
  }

  // 정리
  await prisma.character.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { discordId: testUserId } });
  await prisma.$disconnect();

  console.log('\n🎉 자동 테스트 완료!\n');
}

runAllTests();
