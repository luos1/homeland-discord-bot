// 홈랜드 플레이 테스트 스크립트
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 테스트 사용자 ID (제리 봇)
const TEST_USER_ID = '1465557794811019378';
const TEST_CHANNEL_ID = '1465564324385914983';

async function testPlaythrough() {
  try {
    console.log('🎮 홈랜드 플레이 테스트 시작...\n');

    // 0. User 생성 또는 확인
    await prisma.user.upsert({
      where: { discordId: TEST_USER_ID },
      update: {},
      create: {
        discordId: TEST_USER_ID,
        username: '제리'
      }
    });

    // 1. 기존 캐릭터 삭제 (있으면)
    const existingChar = await prisma.character.findFirst({
      where: { userId: TEST_USER_ID }
    });

    if (existingChar) {
      console.log('기존 캐릭터 삭제 중...');
      await prisma.character.delete({ where: { id: existingChar.id } });
    }

    // 2. 캐릭터 생성
    console.log('✅ 캐릭터 생성: 테스트용');
    const character = await prisma.character.create({
      data: {
        userId: TEST_USER_ID,
        name: '테스트용',
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

    console.log(`캐릭터 생성 완료: Lv${character.level} ${character.name}`);
    console.log(`체력: ${character.currentHp}/${character.maxHp} | 공격: ${character.attack} | 방어: ${character.defense} | 골드: ${character.gold}\n`);

    // 3. 사냥 10회 (레벨업 속도 테스트)
    console.log('🗡️  사냥 시작 (10회)...\n');
    
    for (let i = 1; i <= 10; i++) {
      const char = await prisma.character.findUnique({ where: { id: character.id } });
      
      // 간단한 사냥 로직 (경험치 획득)
      const expGain = Math.floor(Math.random() * 30) + 20; // 20-50 exp
      const goldGain = Math.floor(Math.random() * 20) + 10; // 10-30 gold
      
      const newExp = char.xp + expGain;
      const expNeeded = Math.floor(100 * Math.pow(1.3, char.level - 1));
      
      let updates = {
        xp: newExp,
        gold: char.gold + goldGain
      };

      // 레벨업 체크
      if (newExp >= expNeeded) {
        updates.level = char.level + 1;
        updates.xp = newExp - expNeeded;
        updates.maxHp = char.maxHp + 10;
        updates.hp = char.maxHp + 10;
        updates.attack = char.attack + 2;
        updates.defense = char.defense + 1;
        
        console.log(`  ${i}회: 🎉 레벨업! Lv${char.level} → Lv${updates.level}`);
      } else {
        console.log(`  ${i}회: +${expGain} exp, +${goldGain} gold (${newExp}/${expNeeded})`);
      }

      await prisma.character.update({
        where: { id: character.id },
        data: updates
      });
    }

    // 4. 최종 상태 확인
    const finalChar = await prisma.character.findUnique({ where: { id: character.id } });
    console.log(`\n📊 최종 상태:`);
    console.log(`레벨: ${finalChar.level}`);
    console.log(`경험치: ${finalChar.xp}`);
    console.log(`골드: ${finalChar.gold}`);
    console.log(`공격력: ${finalChar.attack}`);
    console.log(`방어력: ${finalChar.defense}`);
    console.log(`체력: ${finalChar.hp}/${finalChar.maxHp}`);

    // 5. 골드샵 확인
    console.log(`\n🏪 골드샵 아이템 확인...`);
    const { goldShopItems } = require('./src/config/itemConfig');
    console.log(`총 ${goldShopItems.length}개 아이템 등록됨:`);
    goldShopItems.slice(0, 5).forEach(item => {
      console.log(`  - ${item.name}: ${item.price} 골드`);
    });

    console.log('\n✅ 플레이 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPlaythrough();
