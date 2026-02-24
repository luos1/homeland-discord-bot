const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 형아 캐릭터 찾기
    const character = await prisma.character.findFirst({
      where: { userId: '766164672692224010' }
    });
    
    if (!character) {
      console.log('❌ 캐릭터 없음!');
      return;
    }

    // 모든 스킬을 equipped = true로 업데이트
    const result = await prisma.skill.updateMany({
      where: { characterId: character.id },
      data: { equipped: true }
    });

    console.log(`✅ ${result.count}개 스킬 장착 완료!`);
    
    // 확인
    const skills = await prisma.skill.findMany({
      where: { characterId: character.id }
    });
    
    console.log('\n🎯 현재 스킬:');
    skills.forEach(skill => {
      console.log(`   - ${skill.skillKey} (Lv.${skill.skillLevel}, 장착: ${skill.equipped ? 'O' : 'X'})`);
    });
  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
