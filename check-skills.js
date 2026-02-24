const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const character = await prisma.character.findFirst({
      where: { userId: '766164672692224010' },
      include: { skills: true }
    });
    
    if (character) {
      console.log('\n👤 형아 캐릭터:');
      console.log(`   이름: ${character.name}`);
      console.log(`   클래스: ${character.class}`);
      console.log(`   전직: ${character.advancedClass || '없음'}`);
      console.log(`   레벨: ${character.level}`);
      
      console.log('\n🎯 스킬 목록:');
      if (character.skills.length === 0) {
        console.log('   ❌ 스킬 없음!');
      } else {
        character.skills.forEach(skill => {
          console.log(`   - ${skill.skillKey} (Lv.${skill.skillLevel})`);
        });
      }
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
