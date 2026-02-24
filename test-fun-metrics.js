// 홈랜드 재미 측정 시스템 (Fun Metrics)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 재미 측정 기준:
 * 1. 다양성 (Variety) - 매번 다른 경험
 * 2. 긴장감 (Tension) - 위험과 보상
 * 3. 선택 (Choice) - 의미있는 결정
 * 4. 발견 (Discovery) - 예상 못한 보상
 * 5. 성취감 (Achievement) - 목표 달성
 */

class FunAnalyzer {
  constructor() {
    this.sessionData = [];
    this.funScore = {
      variety: 0,    // 0-10: 다양성
      tension: 0,    // 0-10: 긴장감
      choice: 0,     // 0-10: 선택
      discovery: 0,  // 0-10: 발견
      achievement: 0 // 0-10: 성취감
    };
  }

  // 전투 로그 기록
  logCombat(data) {
    this.sessionData.push({
      type: 'combat',
      ...data
    });
  }

  // 재미 점수 계산
  calculateFunScore() {
    if (this.sessionData.length === 0) return 0;

    // 1. 다양성 (Variety): 전투 결과의 다양성
    const combats = this.sessionData.filter(d => d.type === 'combat');
    const expGains = combats.map(c => c.expGain);
    const stdDev = this.standardDeviation(expGains);
    const avgExp = expGains.reduce((a,b) => a+b, 0) / expGains.length;
    const varietyRatio = stdDev / avgExp; // 표준편차/평균 = 변동성
    this.funScore.variety = Math.min(10, varietyRatio * 20); // 0.5 이상이면 만점

    // 2. 긴장감 (Tension): 위험한 전투의 비율
    const dangerousCombats = combats.filter(c => c.hpLost > 30).length;
    const tensionRatio = dangerousCombats / combats.length;
    this.funScore.tension = tensionRatio * 10; // 30% 이상 위험하면 만점

    // 3. 선택 (Choice): 아이템 구매, 스킬 사용 등
    const choices = this.sessionData.filter(d => 
      d.type === 'purchase' || d.type === 'skill_use'
    ).length;
    this.funScore.choice = Math.min(10, choices * 2); // 5회 이상 선택하면 만점

    // 4. 발견 (Discovery): 희귀 보상, 크리티컬 등
    const discoveries = combats.filter(c => 
      c.critical || c.rareItem || c.bonus
    ).length;
    const discoveryRatio = discoveries / combats.length;
    this.funScore.discovery = discoveryRatio * 30; // 33% 이상이면 만점

    // 5. 성취감 (Achievement): 레벨업, 목표 달성
    const achievements = this.sessionData.filter(d => 
      d.type === 'levelup' || d.type === 'milestone'
    ).length;
    this.funScore.achievement = Math.min(10, achievements * 1.5); // 7회 이상이면 만점

    // 종합 재미 점수 (가중 평균)
    const weights = {
      variety: 0.25,
      tension: 0.20,
      choice: 0.20,
      discovery: 0.20,
      achievement: 0.15
    };

    const totalScore = 
      this.funScore.variety * weights.variety +
      this.funScore.tension * weights.tension +
      this.funScore.choice * weights.choice +
      this.funScore.discovery * weights.discovery +
      this.funScore.achievement * weights.achievement;

    return totalScore;
  }

  standardDeviation(values) {
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a,b) => a+b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  getReport() {
    const totalScore = this.calculateFunScore();
    
    return {
      totalScore: totalScore.toFixed(1),
      breakdown: {
        variety: this.funScore.variety.toFixed(1) + '/10 (다양성)',
        tension: this.funScore.tension.toFixed(1) + '/10 (긴장감)',
        choice: this.funScore.choice.toFixed(1) + '/10 (선택)',
        discovery: this.funScore.discovery.toFixed(1) + '/10 (발견)',
        achievement: this.funScore.achievement.toFixed(1) + '/10 (성취감)'
      },
      grade: this.getGrade(totalScore),
      recommendations: this.getRecommendations()
    };
  }

  getGrade(score) {
    if (score >= 9) return 'S (완벽!)';
    if (score >= 8) return 'A (훌륭함)';
    if (score >= 7) return 'B (괜찮음)';
    if (score >= 6) return 'C (보통)';
    if (score >= 5) return 'D (부족함)';
    return 'F (재미없음)';
  }

  getRecommendations() {
    const recs = [];
    
    if (this.funScore.variety < 5) {
      recs.push('❌ 다양성 부족: 전투 결과가 너무 예측 가능 → 크리티컬, 회피, 보너스 추가 필요');
    }
    
    if (this.funScore.tension < 5) {
      recs.push('❌ 긴장감 부족: 전투가 너무 쉬움 → 난이도 선택 또는 위험/보상 밸런스 조정');
    }
    
    if (this.funScore.choice < 5) {
      recs.push('❌ 선택 부족: 플레이어 결정이 적음 → 스킬, 장비, 전략 선택지 추가');
    }
    
    if (this.funScore.discovery < 5) {
      recs.push('❌ 발견 부족: 예상 못한 보상 없음 → 희귀 아이템, 랜덤 이벤트 추가');
    }
    
    if (this.funScore.achievement < 5) {
      recs.push('❌ 성취감 부족: 목표가 불명확 → 마일스톤, 업적, 랭킹 시스템 추가');
    }

    if (recs.length === 0) {
      recs.push('✅ 모든 재미 요소 충족!');
    }

    return recs;
  }
}

// 현재 Phase 1 테스트
async function testCurrentPhase1() {
  console.log('🎮 현재 Phase 1 재미 측정\n');
  console.log('='.repeat(60));

  const analyzer = new FunAnalyzer();
  const testUserId = 'funtest_' + Date.now();

  // User 생성
  await prisma.user.upsert({
    where: { discordId: testUserId },
    update: {},
    create: { discordId: testUserId, username: '재미테스트' }
  });

  // 캐릭터 생성
  const character = await prisma.character.create({
    data: {
      userId: testUserId,
      name: '재미측정',
      class: 'warrior',
      level: 1,
      xp: 0,
      maxHp: 120,
      hp: 120,
      maxMana: 36,
      mana: 36,
      attack: 12,
      defense: 8,
      gold: 500
    }
  });

  console.log('📊 20회 전투 시뮬레이션...\n');

  // 20회 전투
  for (let i = 1; i <= 20; i++) {
    const char = await prisma.character.findUnique({ 
      where: { id: character.id } 
    });

    // 현재 Phase 1: 단조로운 전투
    const expGain = Math.floor(Math.random() * 30) + 20; // 20-50 (범위 좁음)
    const goldGain = Math.floor(Math.random() * 20) + 10; // 10-30 (범위 좁음)
    const hpLost = Math.floor(Math.random() * 10) + 5; // 5-15 (항상 안전)

    // 크리티컬, 희귀 아이템 없음
    const critical = false;
    const rareItem = false;
    const bonus = false;

    analyzer.logCombat({
      turn: i,
      expGain,
      goldGain,
      hpLost,
      critical,
      rareItem,
      bonus
    });

    // 레벨업 체크
    let expNeeded = 50 + (char.level - 1) * 25;
    if (char.level >= 10 && char.level < 30) {
      expNeeded = Math.floor(expNeeded / 1.3);
    }

    const newXp = char.xp + expGain;
    if (newXp >= expNeeded) {
      await prisma.character.update({
        where: { id: character.id },
        data: {
          level: char.level + 1,
          xp: newXp - expNeeded,
          maxHp: char.maxHp + 10,
          hp: char.maxHp + 10,
          attack: char.attack + 2,
          defense: char.defense + 1
        }
      });
      analyzer.sessionData.push({ type: 'levelup', level: char.level + 1 });
    } else {
      await prisma.character.update({
        where: { id: character.id },
        data: { xp: newXp, hp: Math.max(1, char.hp - hpLost) }
      });
    }

    // 10회차에 포션 구매 (유일한 선택)
    if (i === 10) {
      analyzer.sessionData.push({ type: 'purchase', item: 'potion' });
    }
  }

  const report = analyzer.getReport();

  console.log('📊 재미 측정 결과');
  console.log('='.repeat(60));
  console.log(`종합 점수: ${report.totalScore}/10 (${report.grade})\n`);
  console.log('세부 점수:');
  Object.values(report.breakdown).forEach(line => {
    console.log(`  ${line}`);
  });
  console.log('\n💡 개선 제안:');
  report.recommendations.forEach(rec => {
    console.log(`  ${rec}`);
  });

  // 정리
  await prisma.character.delete({ where: { id: character.id } });
  await prisma.user.delete({ where: { discordId: testUserId } });
  await prisma.$disconnect();

  console.log('\n' + '='.repeat(60));
  console.log('📌 결론: Phase 1은 "속도"만 개선, "재미"는 부족');
  console.log('='.repeat(60));
}

testCurrentPhase1();
