// 통합 테스트 - 핵심 플로우 검증
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 테스트 결과 추적
const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    results.passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   에러: ${error.message}`);
    results.failed++;
    results.errors.push({ name, error: error.message });
  }
}

async function main() {
  console.log('🔍 통합 테스트 시작...\n');

  // ═══════════════════════════════════════
  // 1. 데이터 일관성 테스트
  // ═══════════════════════════════════════
  console.log('1️⃣ 데이터 일관성 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━\n');

  await test('모든 캐릭터가 유효한 클래스를 가짐', async () => {
    const characters = await prisma.character.findMany();
    const validClasses = ['전사', '궁수', '마법사'];
    const invalid = characters.filter(c => !validClasses.includes(c.class));
    if (invalid.length > 0) {
      throw new Error(`잘못된 클래스: ${invalid.map(c => c.class).join(', ')}`);
    }
  });

  await test('모든 스킬이 장착 상태 있음', async () => {
    const skills = await prisma.skill.findMany();
    const noEquipped = skills.filter(s => s.equipped === null || s.equipped === undefined);
    if (noEquipped.length > 0) {
      throw new Error(`equipped 없는 스킬: ${noEquipped.length}개`);
    }
  });

  await test('모든 캐릭터가 HP/마나 있음', async () => {
    const characters = await prisma.character.findMany();
    const invalid = characters.filter(c => !c.maxHp || !c.maxMana);
    if (invalid.length > 0) {
      throw new Error(`HP/마나 없음: ${invalid.length}개`);
    }
  });

  console.log('');

  // ═══════════════════════════════════════
  // 2. 스킬 시스템 테스트
  // ═══════════════════════════════════════
  console.log('2️⃣ 스킬 시스템 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━\n');

  await test('전사 스킬 조회', async () => {
    const { SKILLS } = require('./src/game/skills');
    const { CLASS_NAME_MAP } = require('./src/game/skills');
    const classKey = CLASS_NAME_MAP['전사'];
    const skills = SKILLS[classKey];
    if (!skills || skills.length === 0) {
      throw new Error('전사 스킬 없음');
    }
  });

  await test('궁수 스킬 조회', async () => {
    const { SKILLS } = require('./src/game/skills');
    const { CLASS_NAME_MAP } = require('./src/game/skills');
    const classKey = CLASS_NAME_MAP['궁수'];
    const skills = SKILLS[classKey];
    if (!skills || skills.length === 0) {
      throw new Error('궁수 스킬 없음');
    }
  });

  await test('마법사 스킬 조회', async () => {
    const { SKILLS } = require('./src/game/skills');
    const { CLASS_NAME_MAP } = require('./src/game/skills');
    const classKey = CLASS_NAME_MAP['마법사'];
    const skills = SKILLS[classKey];
    if (!skills || skills.length === 0) {
      throw new Error('마법사 스킬 없음');
    }
  });

  console.log('');

  // ═══════════════════════════════════════
  // 3. 전투 시스템 테스트
  // ═══════════════════════════════════════
  console.log('3️⃣ 전투 시스템 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━\n');

  await test('몬스터 데이터 로드', async () => {
    const { MONSTERS } = require('./src/game/monsters');
    if (!MONSTERS || Object.keys(MONSTERS).length === 0) {
      throw new Error('몬스터 데이터 없음');
    }
  });

  await test('존 데이터 로드', async () => {
    const { listZones } = require('./src/game/monsters');
    const zones = listZones();
    if (!zones || zones.length === 0) {
      throw new Error('존 데이터 없음');
    }
  });

  await test('전투 액션 정의', async () => {
    const { COMBAT_ACTIONS } = require('./src/game/combat');
    const required = ['attack', 'defend', 'skill', 'potion', 'flee'];
    const missing = required.filter(a => !COMBAT_ACTIONS[a]);
    if (missing.length > 0) {
      throw new Error(`누락된 액션: ${missing.join(', ')}`);
    }
  });

  console.log('');

  // ═══════════════════════════════════════
  // 4. 경제 시스템 테스트
  // ═══════════════════════════════════════
  console.log('4️⃣ 경제 시스템 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━\n');

  await test('장비 데이터 로드', async () => {
    const { EQUIPMENT_TYPES, RARITIES } = require('./src/game/equipment');
    if (!EQUIPMENT_TYPES || !RARITIES) {
      throw new Error('장비 데이터 없음');
    }
  });

  await test('자원 데이터 로드', async () => {
    const { RESOURCES } = require('./src/game/production-classes');
    if (!RESOURCES || Object.keys(RESOURCES).length === 0) {
      throw new Error('자원 데이터 없음');
    }
  });

  console.log('');

  // ═══════════════════════════════════════
  // 5. 명령어 로드 테스트
  // ═══════════════════════════════════════
  console.log('5️⃣ 명령어 로드 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━\n');

  const fs = require('fs');
  const path = require('path');
  const commandFiles = fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const commandName = file.replace('.js', '');
    await test(`명령어: ${commandName}`, async () => {
      const command = require(`./src/commands/${file}`);
      // 버튼 전용 핸들러는 예외
      if (command.isButtonHandlerOnly) {
        return;
      }
      if (!command.data || !command.execute) {
        throw new Error('data 또는 execute 없음');
      }
    });
  }

  console.log('');

  // ═══════════════════════════════════════
  // 최종 결과
  // ═══════════════════════════════════════
  console.log('═══════════════════════════════════════');
  console.log('📊 최종 결과');
  console.log('═══════════════════════════════════════');
  console.log(`✅ 성공: ${results.passed}`);
  console.log(`❌ 실패: ${results.failed}`);
  console.log(`📈 성공률: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  console.log('═══════════════════════════════════════\n');

  if (results.failed > 0) {
    console.log('❌ 실패한 테스트:\n');
    results.errors.forEach((e, i) => {
      console.log(`${i + 1}. ${e.name}`);
      console.log(`   → ${e.error}\n`);
    });
    process.exit(1);
  } else {
    console.log('✅ 모든 테스트 통과!\n');
    process.exit(0);
  }
}

main()
  .catch(error => {
    console.error('💥 테스트 실행 실패:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
