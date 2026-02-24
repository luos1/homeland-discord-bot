const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 테이블 존재 확인
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table';
    `;
    console.log('📊 테이블 목록:', tables);

    // 형아 캐릭터 확인
    const character = await prisma.character.findFirst({
      where: { userId: '766164672692224010' }
    });
    
    if (character) {
      console.log('\n👤 형아 캐릭터:');
      console.log(`   이름: ${character.name}`);
      console.log(`   클래스: ${character.class}`);
      console.log(`   전직: ${character.advancedClass || '없음'}`);
      console.log(`   레벨: ${character.level}`);
      console.log(`   골드: ${character.gold}G`);
    } else {
      console.log('\n❌ 캐릭터 없음!');
    }
  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
