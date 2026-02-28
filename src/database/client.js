const { PrismaClient } = require('@prisma/client');

// ═══════════════════════════════════════════════════════════════
// Prisma Client - 싱글톤 + Connection Pool 설정
// Railway Free Postgres: ~20 connections 제한
// connection_limit=10 으로 설정 (여유분 확보)
// ═══════════════════════════════════════════════════════════════

const globalForPrisma = globalThis;

// DATABASE_URL에 connection_limit 추가
function getDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;
  
  // 이미 connection_limit이 있으면 그대로 사용
  if (baseUrl.includes('connection_limit')) {
    return baseUrl;
  }
  
  // connection_limit 추가
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}connection_limit=10`;
}

// 기존 인스턴스 재사용 (모든 환경에서)
const enableQueryLog = process.env.PRISMA_LOG_QUERIES === 'true';

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: enableQueryLog ? ['query', 'warn', 'error'] : ['warn', 'error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

// 모든 환경에서 싱글톤 유지 (중요!)
globalForPrisma.prisma = prisma;

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = {
  prisma,
};
