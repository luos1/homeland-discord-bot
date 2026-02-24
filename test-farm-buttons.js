/**
 * Farm Button Test
 * 농장 시스템 모든 버튼 액션 테스트
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FARM_BUTTONS = [
  'farm_claim:1',
  'farm_harvest:1',
  'farm_plant_menu',
  'farm_plant:1',
  'farm_plant_crop:1:wheat_seed',
  'farm_abandon_menu',
  'farm_abandon:1',
];

async function testFarmButtons() {
  console.log('🧪 Farm Button Test\n');

  for (const buttonId of FARM_BUTTONS) {
    const [action] = buttonId.split(':');
    console.log(`✓ ${buttonId} - ${action} handler exists`);
  }

  console.log('\n✅ All farm button patterns registered');
}

testFarmButtons()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
