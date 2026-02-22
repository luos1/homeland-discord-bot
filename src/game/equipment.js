const { randomInt } = require('./monsters');

// 장비 타입
const EQUIPMENT_TYPES = {
  weapon: { name: '무기', emoji: '⚔️', slot: 'weapon' },
  armor: { name: '갑옷', emoji: '🛡️', slot: 'armor' },
  boots: { name: '신발', emoji: '👢', slot: 'boots' },
  ring: { name: '반지', emoji: '💍', slot: 'ring' },
};

// 희귀도 (확률)
const RARITIES = {
  common: {
    name: '일반',
    emoji: '⚪',
    color: 0x9ca3af,
    dropChance: 0.7, // 70%
    statMultiplier: 1.0,
  },
  uncommon: {
    name: '고급',
    emoji: '🟢',
    color: 0x10b981,
    dropChance: 0.2, // 20%
    statMultiplier: 1.5,
  },
  rare: {
    name: '희귀',
    emoji: '🔵',
    color: 0x3b82f6,
    dropChance: 0.08, // 8%
    statMultiplier: 2.0,
  },
  epic: {
    name: '영웅',
    emoji: '🟣',
    color: 0xa855f7,
    dropChance: 0.015, // 1.5%
    statMultiplier: 3.0,
  },
  legendary: {
    name: '전설',
    emoji: '🟠',
    color: 0xf97316,
    dropChance: 0.005, // 0.5%
    statMultiplier: 5.0,
  },
};

// 특수 효과
const EFFECTS = {
  fire: {
    name: '화염',
    emoji: '🔥',
    description: '추가 화염 피해 +10%',
  },
  ice: {
    name: '빙결',
    emoji: '❄️',
    description: '적 공격력 -20%',
  },
  lightning: {
    name: '번개',
    emoji: '⚡',
    description: '크리티컬 확률 +10%',
  },
  lifesteal: {
    name: '생명력 흡수',
    emoji: '💎',
    description: '피해량의 10% HP 회복',
  },
  dodge: {
    name: '회피',
    emoji: '💨',
    description: '회피율 +15%',
  },
  regeneration: {
    name: '재생',
    emoji: '💚',
    description: '턴마다 HP 5% 회복',
  },
};

// 장비 이름 생성
const WEAPON_NAMES = {
  common: ['낡은 검', '녹슨 도끼', '나무 지팡이', '돌칼'],
  uncommon: ['강철 검', '전투 도끼', '마법 지팡이', '은 단검'],
  rare: ['정령의 검', '광전사의 도끼', '현자의 지팡이', '어둠의 단검'],
  epic: ['드래곤 슬레이어', '멸망의 도끼', '대마법사의 지팡이', '암살자의 단검'],
  legendary: ['엑스칼리버', '천둥의 망치', '시간의 지팡이', '영혼 수확자'],
};

const ARMOR_NAMES = {
  common: ['낡은 갑옷', '가죽 갑옷', '천 로브', '누더기 옷'],
  uncommon: ['강철 갑옷', '정예 가죽', '마법사 로브', '은 갑주'],
  rare: ['정령의 갑옷', '용 비늘 갑옷', '현자의 로브', '그림자 갑주'],
  epic: ['불멸의 갑옷', '드래곤 갑주', '대마법사 로브', '암흑 갑주'],
  legendary: ['신의 갑옷', '세계수 갑주', '시공간 로브', '절대자의 갑옷'],
};

const BOOTS_NAMES = {
  common: ['낡은 신발', '천 신발', '가죽 부츠', '나막신'],
  uncommon: ['전투화', '행군화', '마법 부츠', '은 그리브'],
  rare: ['질풍의 신발', '전사의 부츠', '현자의 샌들', '그림자 부츠'],
  epic: ['신속의 신발', '거인의 부츠', '순간이동 부츠', '시간의 신발'],
  legendary: ['신의 신발', '세계를 걷는 자', '차원 이동화', '절대 속도'],
};

const RING_NAMES = {
  common: ['구리 반지', '나무 반지', '돌 반지', '철 반지'],
  uncommon: ['은 반지', '루비 반지', '사파이어 반지', '강철 반지'],
  rare: ['정령의 반지', '마법 반지', '현자의 반지', '어둠의 반지'],
  epic: ['힘의 반지', '마력의 반지', '지혜의 반지', '그림자 반지'],
  legendary: ['절대자의 반지', '원 링', '우주의 반지', '시간의 반지'],
};

function rollRarity() {
  const roll = Math.random();
  let cumulative = 0;

  // 전설부터 체크 (확률 낮은 것부터)
  for (const [key, data] of Object.entries(RARITIES).reverse()) {
    cumulative += data.dropChance;
    if (roll < cumulative) {
      return key;
    }
  }

  return 'common'; // 기본값
}

function getEquipmentName(type, rarity) {
  const names = {
    weapon: WEAPON_NAMES,
    armor: ARMOR_NAMES,
    boots: BOOTS_NAMES,
    ring: RING_NAMES,
  };

  const typeNames = names[type] || WEAPON_NAMES;
  const rarityNames = typeNames[rarity] || typeNames.common;

  return rarityNames[randomInt(0, rarityNames.length - 1)];
}

function rollEffect(rarity) {
  // 희귀도에 따라 특수 효과 확률
  const effectChance = {
    common: 0,
    uncommon: 0.1,
    rare: 0.3,
    epic: 0.6,
    legendary: 1.0,
  };

  const chance = effectChance[rarity] || 0;

  if (Math.random() > chance) {
    return null;
  }

  const effects = Object.keys(EFFECTS);
  return effects[randomInt(0, effects.length - 1)];
}

function generateEquipment(characterLevel, options = {}) {
  const forceType = options.type;
  const forceRarity = options.rarity;

  // 장비 타입 결정
  const typeKeys = Object.keys(EQUIPMENT_TYPES);
  const type = forceType || typeKeys[randomInt(0, typeKeys.length - 1)];

  // 희귀도 결정
  const rarity = forceRarity || rollRarity();
  const rarityData = RARITIES[rarity];

  // 이름 생성
  const name = getEquipmentName(type, rarity);

  // 기본 스탯 (캐릭터 레벨 기반)
  const baseStats = {
    weapon: {
      attack: Math.floor(characterLevel * 0.5 + 5),
      defense: 0,
      hp: 0,
      mana: 0,
    },
    armor: {
      attack: 0,
      defense: Math.floor(characterLevel * 0.4 + 3),
      hp: Math.floor(characterLevel * 2 + 10),
      mana: 0,
    },
    boots: {
      attack: 0,
      defense: Math.floor(characterLevel * 0.2 + 1),
      hp: Math.floor(characterLevel * 1.5 + 8),
      mana: 0,
    },
    ring: {
      attack: Math.floor(characterLevel * 0.3 + 2),
      defense: Math.floor(characterLevel * 0.2 + 1),
      hp: 0,
      mana: Math.floor(characterLevel * 0.5 + 5),
    },
  };

  const stats = baseStats[type];

  // 희귀도 배율 적용
  const multiplier = rarityData.statMultiplier;

  // 특수 효과
  const effect = rollEffect(rarity);

  return {
    name,
    type,
    rarity,
    attack: Math.floor(stats.attack * multiplier),
    defense: Math.floor(stats.defense * multiplier),
    hp: Math.floor(stats.hp * multiplier),
    mana: Math.floor(stats.mana * multiplier),
    effect,
  };
}

function shouldDropEquipment() {
  // 10% 확률로 장비 드롭
  return Math.random() < 0.1;
}

function getEquipmentEmbed(equipment) {
  const typeData = EQUIPMENT_TYPES[equipment.type];
  const rarityData = RARITIES[equipment.rarity];
  const effectData = equipment.effect ? EFFECTS[equipment.effect] : null;

  const stats = [];
  if (equipment.attack > 0) stats.push(`⚔️ 공격력 +${equipment.attack}`);
  if (equipment.defense > 0) stats.push(`🛡️ 방어력 +${equipment.defense}`);
  if (equipment.hp > 0) stats.push(`❤️ 최대 체력 +${equipment.hp}`);
  if (equipment.mana > 0) stats.push(`🔷 최대 마나 +${equipment.mana}`);

  return {
    title: `${rarityData.emoji} ${equipment.name}`,
    description: [
      `${typeData.emoji} ${typeData.name} | ${rarityData.name}`,
      '',
      '📊 능력치',
      ...stats,
      effectData ? '' : null,
      effectData ? `✨ ${effectData.emoji} ${effectData.name}` : null,
      effectData ? `   ${effectData.description}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    color: rarityData.color,
  };
}

function calculateEquipmentStats(equipmentList) {
  const stats = {
    attack: 0,
    defense: 0,
    hp: 0,
    mana: 0,
    effects: [],
  };

  for (const eq of equipmentList.filter((e) => e.equipped)) {
    stats.attack += eq.attack;
    stats.defense += eq.defense;
    stats.hp += eq.hp;
    stats.mana += eq.mana;

    if (eq.effect) {
      stats.effects.push(eq.effect);
    }
  }

  return stats;
}

module.exports = {
  EQUIPMENT_TYPES,
  RARITIES,
  EFFECTS,
  rollRarity,
  generateEquipment,
  shouldDropEquipment,
  getEquipmentEmbed,
  calculateEquipmentStats,
};
