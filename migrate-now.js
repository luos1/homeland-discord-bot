#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const migrations = [
  path.join(__dirname, 'all-migrations.sql')
];

async function runMigrations() {
  console.log('🔄 Phase 1 마이그레이션 시작...\n');

  for (const migrationPath of migrations) {
    console.log(`📄 ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`  ⏭️  파일 없음\n`);
      continue;
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 5);
    
    let success = 0;
    let skipped = 0;
    
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        success++;
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          skipped++;
        } else {
          console.error(`  ❌ 실패: ${err.message.substring(0, 100)}`);
          throw err;
        }
      }
    }
    
    console.log(`  ✅ ${success} 성공${skipped > 0 ? `, ${skipped} 건너뜀` : ''}\n`);
  }

  console.log('🎉 마이그레이션 완료!');
}

runMigrations()
  .catch(err => {
    console.error('❌ 마이그레이션 실패:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
