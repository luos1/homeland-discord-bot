/**
 * Farm Field System
 * T3+ Zone 필드 점유 농장 시스템
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ===== 필드 타입 정의 =====

const FIELD_TYPES = {
  // Zone 3 (초급)
  wheat: {
    zone: 'zone3',
    name: '밀밭',
    emoji: '🌾',
    claimCost: 5000,
    dailyFee: 500,
    maxFields: 4,
  },
  carrot: {
    zone: 'zone3',
    name: '당근밭',
    emoji: '🥕',
    claimCost: 4000,
    dailyFee: 400,
    maxFields: 4,
  },
  herb: {
    zone: 'zone3',
    name: '허브밭',
    emoji: '🌿',
    claimCost: 6000,
    dailyFee: 600,
    maxFields: 2,
  },
  
  // Zone 4 (중급)
  grape: {
    zone: 'zone4',
    name: '포도밭',
    emoji: '🍇',
    claimCost: 10000,
    dailyFee: 1000,
    maxFields: 3,
  },
  magic_herb: {
    zone: 'zone4',
    name: '마법 약초밭',
    emoji: '🌺',
    claimCost: 15000,
    dailyFee: 1500,
    maxFields: 3,
  },
  mine: {
    zone: 'zone4',
    name: '광산',
    emoji: '⛏️',
    claimCost: 20000,
    dailyFee: 2000,
    maxFields: 2,
  },
  
  // Zone 5 (고급)
  magic_crop: {
    zone: 'zone5',
    name: '마법 작물 밭',
    emoji: '✨',
    claimCost: 50000,
    dailyFee: 5000,
    maxFields: 2,
  },
  dragon_fruit: {
    zone: 'zone5',
    name: '드래곤 과수원',
    emoji: '🐉',
    claimCost: 100000,
    dailyFee: 10000,
    maxFields: 1,
  },
  mythril: {
    zone: 'zone5',
    name: '미스릴 광산',
    emoji: '💎',
    claimCost: 150000,
    dailyFee: 15000,
    maxFields: 1,
  },
};

// ===== 작물 정의 =====

const CROP_TYPES = {
  // Zone 3
  wheat_seed: {
    name: '밀',
    emoji: '🌾',
    fieldType: 'wheat',
    seedCost: 100,
    growthHours: 6,
    harvestAmount: 20,
    resourceType: 'wheat',
  },
  carrot_seed: {
    name: '당근',
    emoji: '🥕',
    fieldType: 'carrot',
    seedCost: 80,
    growthHours: 4,
    harvestAmount: 30,
    resourceType: 'carrot',
  },
  herb_seed: {
    name: '허브',
    emoji: '🌿',
    fieldType: 'herb',
    seedCost: 150,
    growthHours: 8,
    harvestAmount: 10,
    resourceType: 'herb',
  },
  
  // Zone 4
  grape_seed: {
    name: '포도',
    emoji: '🍇',
    fieldType: 'grape',
    seedCost: 300,
    growthHours: 12,
    harvestAmount: 15,
    resourceType: 'grape',
  },
  magic_herb_seed: {
    name: '마법 약초',
    emoji: '🌺',
    fieldType: 'magic_herb',
    seedCost: 400,
    growthHours: 10,
    harvestAmount: 8,
    resourceType: 'magic_herb',
  },
  iron_ore_drill: {
    name: '철광석',
    emoji: '⛏️',
    fieldType: 'mine',
    seedCost: 500,
    growthHours: 24,
    harvestAmount: 25,
    resourceType: 'iron_ore',
  },
  
  // Zone 5
  magic_crop_seed: {
    name: '마법 작물',
    emoji: '✨',
    fieldType: 'magic_crop',
    seedCost: 2000,
    growthHours: 48,
    harvestAmount: 5,
    resourceType: 'magic_crystal',
  },
  dragon_fruit_seed: {
    name: '드래곤 과일',
    emoji: '🐉',
    fieldType: 'dragon_fruit',
    seedCost: 5000,
    growthHours: 72,
    harvestAmount: 3,
    resourceType: 'dragon_essence',
  },
  mythril_drill: {
    name: '미스릴',
    emoji: '💎',
    fieldType: 'mythril',
    seedCost: 10000,
    growthHours: 96,
    harvestAmount: 10,
    resourceType: 'mythril',
  },
};

// ===== 필드 초기화 =====

async function initializeFields() {
  const fields = [];
  
  for (const [fieldType, config] of Object.entries(FIELD_TYPES)) {
    for (let i = 1; i <= config.maxFields; i++) {
      fields.push({
        zone: config.zone,
        fieldType,
        fieldIndex: i,
      });
    }
  }
  
  for (const field of fields) {
    await prisma.farmField.upsert({
      where: {
        zone_fieldType_fieldIndex: {
          zone: field.zone,
          fieldType: field.fieldType,
          fieldIndex: field.fieldIndex,
        },
      },
      update: {},
      create: field,
    });
  }
  
  console.log(`[Farm] Initialized ${fields.length} farm fields`);
}

// ===== 필드 조회 =====

async function getAvailableFields(zone) {
  return await prisma.farmField.findMany({
    where: {
      zone,
      ownerId: null,
    },
    orderBy: [
      { fieldType: 'asc' },
      { fieldIndex: 'asc' },
    ],
  });
}

async function getOwnedFields(characterId) {
  return await prisma.farmField.findMany({
    where: {
      ownerId: characterId,
    },
    include: {
      raids: {
        orderBy: { raidedAt: 'desc' },
        take: 5,
      },
    },
  });
}

// ===== 필드 점유 =====

async function claimField(characterId, fieldId) {
  const field = await prisma.farmField.findUnique({
    where: { id: fieldId },
  });
  
  if (!field) {
    return { success: false, error: '필드를 찾을 수 없습니다.' };
  }
  
  if (field.ownerId) {
    return { success: false, error: '이미 점유된 필드입니다.' };
  }
  
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { ownedFields: true },
  });
  
  if (!character) {
    return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
  }
  
  const fieldConfig = FIELD_TYPES[field.fieldType];
  const maxFields = character.specialProductionClass === 'druid' ? 4 : 2;
  
  if (character.ownedFields.length >= maxFields) {
    return { success: false, error: `최대 ${maxFields}개의 필드만 점유할 수 있습니다.` };
  }
  
  if (character.gold < fieldConfig.claimCost) {
    return { success: false, error: `골드가 부족합니다. (${fieldConfig.claimCost.toLocaleString()}G 필요)` };
  }
  
  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: characterId },
      data: {
        gold: {
          decrement: fieldConfig.claimCost,
        },
      },
    });
    
    await tx.farmField.update({
      where: { id: fieldId },
      data: {
        ownerId: characterId,
        claimedAt: new Date(),
        lastPaid: new Date(),
      },
    });
  });
  
  return {
    success: true,
    message: `✅ ${fieldConfig.emoji} ${fieldConfig.name} #${field.fieldIndex}를 점유했습니다!\n💰 ${fieldConfig.claimCost.toLocaleString()}G 차감\n💡 유지비: ${fieldConfig.dailyFee.toLocaleString()}G/일`,
  };
}

// ===== 작물 심기 =====

async function plantCrop(fieldId, cropType) {
  const field = await prisma.farmField.findUnique({
    where: { id: fieldId },
    include: { owner: true },
  });
  
  if (!field || !field.owner) {
    return { success: false, error: '필드를 찾을 수 없습니다.' };
  }
  
  if (field.cropType) {
    return { success: false, error: '이미 작물이 심어져 있습니다.' };
  }
  
  const crop = CROP_TYPES[cropType];
  if (!crop) {
    return { success: false, error: '존재하지 않는 작물입니다.' };
  }
  
  if (crop.fieldType !== field.fieldType) {
    return { success: false, error: '이 필드에 심을 수 없는 작물입니다.' };
  }
  
  if (field.owner.gold < crop.seedCost) {
    return { success: false, error: `골드가 부족합니다. (${crop.seedCost.toLocaleString()}G 필요)` };
  }
  
  const now = new Date();
  let growthHours = crop.growthHours;
  
  // 드루이드 보너스: 성장 속도 +50%
  if (field.owner.specialProductionClass === 'druid') {
    growthHours = Math.ceil(growthHours * 0.5);
  }
  
  const harvestAt = new Date(now.getTime() + growthHours * 60 * 60 * 1000);
  
  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: field.ownerId },
      data: {
        gold: {
          decrement: crop.seedCost,
        },
      },
    });
    
    await tx.farmField.update({
      where: { id: fieldId },
      data: {
        cropType,
        plantedAt: now,
        harvestAt,
        waterCount: 0,
      },
    });
  });
  
  return {
    success: true,
    message: `✅ ${crop.emoji} ${crop.name}을(를) 심었습니다!\n⏰ 수확 시간: ${harvestAt.toLocaleString('ko-KR')}`,
  };
}

// ===== 작물 수확 =====

async function harvestCrop(fieldId) {
  const field = await prisma.farmField.findUnique({
    where: { id: fieldId },
    include: { owner: true },
  });
  
  if (!field || !field.owner) {
    return { success: false, error: '필드를 찾을 수 없습니다.' };
  }
  
  if (!field.cropType) {
    return { success: false, error: '심어진 작물이 없습니다.' };
  }
  
  if (new Date() < new Date(field.harvestAt)) {
    return { success: false, error: '아직 수확할 수 없습니다.' };
  }
  
  const crop = CROP_TYPES[field.cropType];
  let amount = crop.harvestAmount;
  
  // 드루이드 보너스: 수확량 +30%
  if (field.owner.specialProductionClass === 'druid') {
    amount = Math.ceil(amount * 1.3);
  }
  
  await prisma.$transaction(async (tx) => {
    // 자원 추가
    const existing = await tx.resource.findUnique({
      where: {
        characterId_type: {
          characterId: field.ownerId,
          type: crop.resourceType,
        },
      },
    });
    
    if (existing) {
      await tx.resource.update({
        where: { id: existing.id },
        data: {
          quantity: {
            increment: amount,
          },
        },
      });
    } else {
      await tx.resource.create({
        data: {
          characterId: field.ownerId,
          type: crop.resourceType,
          name: crop.name,
          quantity: amount,
        },
      });
    }
    
    // 필드 초기화
    await tx.farmField.update({
      where: { id: fieldId },
      data: {
        cropType: null,
        plantedAt: null,
        harvestAt: null,
        waterCount: 0,
      },
    });
  });
  
  return {
    success: true,
    message: `✅ 수확 완료!\n${crop.emoji} ${crop.name} x${amount}개 획득`,
  };
}

module.exports = {
  FIELD_TYPES,
  CROP_TYPES,
  initializeFields,
  getAvailableFields,
  getOwnedFields,
  claimField,
  plantCrop,
  harvestCrop,
};
