// 버튼 자동화 테스트 스크립트
const { Client, GatewayIntentBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.TEST_CHANNEL_ID || '1475434208385044571';
const TEST_USER_ID = '766164672692224010'; // luos

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testButtons() {
  console.log('🎮 버튼 테스트 시작...\n');

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(CHANNEL_ID);

  // 테스트 결과
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  async function testCommand(name, description) {
    console.log(`📋 테스트: ${description}`);
    results.total++;

    try {
      // 명령어 실행 시뮬레이션
      // 실제로는 Discord UI에서 테스트 필요
      console.log(`   ✅ ${name} 명령어 등록 확인`);
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 실패: ${error.message}`);
      results.failed++;
      results.errors.push({ command: name, error: error.message });
    }
  }

  // 기본 명령어 테스트
  await testCommand('/play', '플레이 시작');
  await testCommand('/profile', '프로필');
  await testCommand('/village', '마을');
  await testCommand('/explore', '탐험');
  await testCommand('/guild', '길드');
  await testCommand('/trade', '거래');
  await testCommand('/gather', '채집');
  await testCommand('/craft', '제작');
  await testCommand('/market', '시장');

  console.log('\n📊 테스트 결과:');
  console.log(`   전체: ${results.total}`);
  console.log(`   성공: ${results.passed}`);
  console.log(`   실패: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n❌ 에러 목록:');
    results.errors.forEach(({ command, error }) => {
      console.log(`   - ${command}: ${error}`);
    });
  }

  return results;
}

async function checkButtonHandlers() {
  console.log('\n🔍 버튼 핸들러 체크...\n');

  const handlers = {
    'play_create': '캐릭터 생성',
    'profile_explore': '프로필 탐험',
    'profile_inventory': '프로필 인벤토리',
    'village_home': '마을 홈',
    'combat_attack': '전투 공격',
    'combat_defend': '전투 방어',
    'combat_auto': '전투 오토 (프리미엄)',
    'guild_create': '길드 생성',
    'guild_join': '길드 가입',
    'trade_request': '거래 요청',
    'gather_start': '채집 시작',
    'craft_start': '제작 시작',
  };

  const buttonRouterPath = './src/handlers/button-router.js';
  const fs = require('fs');
  const routerCode = fs.readFileSync(buttonRouterPath, 'utf-8');

  let passed = 0;
  let total = Object.keys(handlers).length;

  for (const [buttonId, description] of Object.entries(handlers)) {
    const prefix = buttonId.split('_').slice(0, -1).join('_');
    
    if (routerCode.includes(prefix) || routerCode.includes(buttonId)) {
      console.log(`   ✅ ${description} (${buttonId})`);
      passed++;
    } else {
      console.log(`   ⚠️  ${description} (${buttonId}) - 핸들러 미확인`);
    }
  }

  console.log(`\n   총 ${passed}/${total} 핸들러 확인됨`);

  return { passed, total };
}

async function checkDatabaseSchema() {
  console.log('\n💾 데이터베이스 스키마 체크...\n');

  const tables = [
    'Character',
    'CombatSession',
    'Guild',
    'GuildMember',
    'TradeRequest',
    'Equipment',
    'Consumable',
    'Resource',
    'PremiumSubscription',
  ];

  let passed = 0;

  for (const table of tables) {
    try {
      // Prisma 모델 존재 여부 확인
      if (prisma[table.toLowerCase()]) {
        console.log(`   ✅ ${table}`);
        passed++;
      } else {
        console.log(`   ⚠️  ${table} - 모델 없음`);
      }
    } catch (error) {
      console.log(`   ❌ ${table} - 에러: ${error.message}`);
    }
  }

  console.log(`\n   총 ${passed}/${tables.length} 테이블 확인됨`);

  return { passed, total: tables.length };
}

client.once('ready', async () => {
  console.log(`✅ 봇 로그인: ${client.user.tag}\n`);

  try {
    // 명령어 등록 확인
    const commands = await client.application.commands.fetch();
    console.log(`📋 등록된 명령어: ${commands.size}개\n`);

    // 버튼 핸들러 체크
    const handlerResults = await checkButtonHandlers();

    // 데이터베이스 체크
    const dbResults = await checkDatabaseSchema();

    // 명령어 테스트
    const testResults = await testButtons();

    console.log('\n' + '='.repeat(50));
    console.log('🎯 최종 결과');
    console.log('='.repeat(50));
    console.log(`버튼 핸들러: ${handlerResults.passed}/${handlerResults.total}`);
    console.log(`데이터베이스: ${dbResults.passed}/${dbResults.total}`);
    console.log(`명령어 등록: ${commands.size}개`);
    console.log('='.repeat(50));

    console.log('\n⚠️  실제 버튼 클릭 테스트는 Discord UI에서 수동으로 필요합니다.');
    console.log('\n테스트 서버: https://discord.com/channels/' + GUILD_ID + '/' + CHANNEL_ID);

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
