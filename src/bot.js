require('dotenv').config();

// ═══════════════════════════════════════════════════════════════
// 전역 에러 핸들러 (봇 크래시 방지)
// ═══════════════════════════════════════════════════════════════
process.on('unhandledRejection', (reason, promise) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('[CRITICAL] Unhandled Promise Rejection');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('Stack:', reason?.stack);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('uncaughtException', (error) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('[CRITICAL] Uncaught Exception - Bot will restart');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1); // PM2/systemd가 자동 재시작
});

const {
  Client,
  Events,
  GatewayIntentBits,
} = require('discord.js');

// 레이드 서버 시작 (포트 3001)
require('./raid-server');

const { prisma } = require('./database/client');
const { loadCommands, registerCommands } = require('./handlers/command-loader');
const { handleInteraction } = require('./handlers/interaction-handler');
const { startAll, stopAll } = require('./schedulers/scheduler-manager');
const FieldBossSystem = require('./game/field-boss-system');
const GuildWarSystem = require('./game/guild-war-system');

const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL'];

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`필수 환경 변수가 누락되었습니다: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commandData = loadCommands(client);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`${readyClient.user.tag} 계정으로 로그인되었습니다.`);

  try {
    await registerCommands(commandData);
  } catch (error) {
    console.error('슬래시 명령어 등록에 실패했습니다:', error);
  }

  // Initialize Field Boss System
  readyClient.fieldBossSystem = new FieldBossSystem(readyClient);
  await readyClient.fieldBossSystem.start();
  console.log('🐉 Field Boss System initialized');

  // Initialize Guild War System
  readyClient.guildWarSystem = new GuildWarSystem(readyClient);
  await readyClient.guildWarSystem.start();
  console.log('⚔️ Guild War System initialized');

  startAll(prisma, readyClient);
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction, { prisma, client });
});

async function shutdown(signal) {
  console.log(`${signal} 신호를 받아 종료를 시작합니다...`);

  stopAll();

  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (error) => {
  console.error('처리되지 않은 프로미스 거부:', error);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('디스코드 로그인에 실패했습니다:', error);
  process.exit(1);
});
