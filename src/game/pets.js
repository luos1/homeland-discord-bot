/**
 * 🐾 펫 시스템
 * 일일 로그인 7일 보상으로 레전더리 펫 지급
 */

const PETS = {
  legendary_phoenix: {
    key: 'legendary_phoenix',
    name: '불사조',
    type: 'legendary',
    rarity: 'legendary',
    emoji: '🔥🦅',
    description: '전설의 불사조. 7일 연속 출석 보상',
    effects: {
      goldBonus: 0.1, // +10% 골드 획득
      xpBonus: 0.05, // +5% 경험치 획득
    },
  },
  rare_wolf: {
    key: 'rare_wolf',
    name: '늑대',
    type: 'companion',
    rarity: 'rare',
    emoji: '🐺',
    description: '충성스러운 늑대 동료',
    effects: {
      attackBonus: 5, // +5 공격력
    },
  },
  epic_dragon: {
    key: 'epic_dragon',
    name: '드래곤',
    type: 'mount',
    rarity: 'epic',
    emoji: '🐉',
    description: '강력한 드래곤',
    effects: {
      hpBonus: 50, // +50 체력
      attackBonus: 10, // +10 공격력
    },
  },
};

async function grantPet(tx, characterId, petKey) {
  const petData = PETS[petKey];
  if (!petData) {
    throw new Error(`Unknown pet: ${petKey}`);
  }

  // 이미 보유 중인지 확인
  const existing = await tx.pet.findUnique({
    where: {
      characterId_petKey: {
        characterId,
        petKey,
      },
    },
  });

  if (existing) {
    // 이미 보유 중이면 레벨업
    return tx.pet.update({
      where: { id: existing.id },
      data: {
        level: {
          increment: 1,
        },
      },
    });
  }

  // 새 펫 생성
  return tx.pet.create({
    data: {
      characterId,
      petKey: petData.key,
      petName: petData.name,
      petType: petData.type,
      rarity: petData.rarity,
      level: 1,
    },
  });
}

async function getPets(prisma, characterId) {
  const pets = await prisma.pet.findMany({
    where: { characterId },
    orderBy: [
      { rarity: 'desc' },
      { level: 'desc' },
    ],
  });

  return pets.map((pet) => {
    const petData = PETS[pet.petKey];
    return {
      ...pet,
      emoji: petData?.emoji || '🐾',
      description: petData?.description || '',
      effects: petData?.effects || {},
    };
  });
}

function calculatePetBonuses(pets) {
  const bonuses = {
    goldBonus: 0,
    xpBonus: 0,
    attackBonus: 0,
    hpBonus: 0,
  };

  for (const pet of pets) {
    const petData = PETS[pet.petKey];
    if (!petData?.effects) continue;

    bonuses.goldBonus += petData.effects.goldBonus || 0;
    bonuses.xpBonus += petData.effects.xpBonus || 0;
    bonuses.attackBonus += petData.effects.attackBonus || 0;
    bonuses.hpBonus += petData.effects.hpBonus || 0;
  }

  return bonuses;
}

module.exports = {
  PETS,
  grantPet,
  getPets,
  calculatePetBonuses,
};
