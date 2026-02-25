#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Phase 1 마이그레이션 시작...\n');
  
  const sql = fs.readFileSync('./fix-db.sql', 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 5);

  let success = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await prisma.$executeRawUnsafe(stmt + ';');
      success++;
      console.log(`✅ [${i + 1}/${statements.length}] ${stmt.substring(0, 60)}...`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        skipped++;
        console.log(`⏭️  [${i + 1}/${statements.length}] 이미 존재함`);
      } else {
        console.error(`❌ [${i + 1}/${statements.length}] 실패:`, err.message);
        throw err;
      }
    }
  }

  console.log(`\n🎉 마이그레이션 완료!`);
  console.log(`   ✅ 성공: ${success}`);
  console.log(`   ⏭️  건너뜀: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
