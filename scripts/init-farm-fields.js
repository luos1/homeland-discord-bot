/**
 * Initialize Farm Fields
 * Zone 3-5에 농장 필드 생성
 */

const { PrismaClient } = require('@prisma/client');
const { initializeFields } = require('../src/game/farm-fields');

const prisma = new PrismaClient();

async function main() {
  console.log('[Farm] Initializing farm fields...');
  await initializeFields();
  console.log('[Farm] ✅ Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
