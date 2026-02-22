const MONSTERS = {
  skeletonGrunt: {
    name: '스켈레톤 그런트',
    level: 3,
    hp: 45,
    attack: 10,
    defense: 3,
    xpReward: 24,
    goldMin: 10,
    goldMax: 20,
    isBoss: false,
  },
  direWolf: {
    name: '다이어울프',
    level: 5,
    hp: 58,
    attack: 12,
    defense: 4,
    xpReward: 30,
    goldMin: 14,
    goldMax: 26,
  },
  undeadKnight: {
    name: '언데드 기사',
    level: 14,
    hp: 78,
    attack: 15,
    defense: 6,
    xpReward: 44,
    goldMin: 24,
    goldMax: 38,
  },
  goblinShaman: {
    name: '고블린 주술사',
    level: 16,
    hp: 72,
    attack: 16,
    defense: 5,
    xpReward: 48,
    goldMin: 26,
    goldMax: 40,
  },
  ancientDragon: {
    name: '고대 드래곤',
    level: 32,
    hp: 118,
    attack: 24,
    defense: 10,
    xpReward: 86,
    goldMin: 60,
    goldMax: 90,
  },
  lich: {
    name: '리치 군주',
    level: 35,
    hp: 92,
    attack: 22,
    defense: 8,
    xpReward: 76,
    goldMin: 52,
    goldMax: 82,
  },

  // 필드 보스
  alphaWolf: {
    name: '🐺 알파 울프',
    level: 10,
    hp: 250,
    attack: 18,
    defense: 8,
    xpReward: 120,
    goldMin: 100,
    goldMax: 200,
    isBoss: true,
    bossType: 'field',
    guaranteedDrop: {
      rarity: 'uncommon',
      chance: 1.0,
    },
    description: '무리를 이끄는 강력한 늑대 우두머리',
  },

  corruptedKnight: {
    name: '⚔️ 타락한 기사',
    level: 20,
    hp: 500,
    attack: 28,
    defense: 15,
    xpReward: 250,
    goldMin: 200,
    goldMax: 400,
    isBoss: true,
    bossType: 'field',
    guaranteedDrop: {
      rarity: 'rare',
      chance: 1.0,
    },
    description: '어둠에 잠식된 옛 영웅',
  },

  youngDragon: {
    name: '🐉 어린 드래곤',
    level: 35,
    hp: 1200,
    attack: 40,
    defense: 20,
    xpReward: 500,
    goldMin: 500,
    goldMax: 1000,
    isBoss: true,
    bossType: 'field',
    guaranteedDrop: {
      rarity: 'epic',
      chance: 1.0,
    },
    description: '아직 어리지만 강력한 고대의 후예',
  },
};

// 존 타입 정의
const ZONE_TYPES = {
  blue: {
    name: '안전지대',
    emoji: '🔵',
    color: 0x3b82f6,
    rareChanceMultiplier: 1.0, // 기본 5%
    statMultiplier: 1.0, // 능력치 1배
    goldMultiplier: 1.0,
    xpMultiplier: 1.0,
    description: 'PvP 없음, 초보자 구역',
  },
  yellow: {
    name: '경계지대',
    emoji: '🟡',
    color: 0xeab308,
    rareChanceMultiplier: 2.0, // 레어 10%
    statMultiplier: 1.5, // 능력치 1.5배
    goldMultiplier: 1.3,
    xpMultiplier: 1.4,
    description: 'PvP 연습 구역, 중급 난이도',
  },
  red: {
    name: '위험지대',
    emoji: '🔴',
    color: 0xef4444,
    rareChanceMultiplier: 3.0, // 레어 15%
    statMultiplier: 2.0, // 능력치 2배
    goldMultiplier: 1.7,
    xpMultiplier: 1.8,
    description: '고위험 고보상, 고급 난이도',
  },
};

const ZONES = {
  zone1: {
    key: 'zone1',
    label: 'Zone 1',
    name: '초보자 숲',
    emoji: '🌲',
    zoneType: 'blue',
    minLevel: 1,
    recommendedLevel: '1-10',
    rewardStars: '⭐',
    description: '첫 모험가를 위한 숲. 비교적 안전하지만 방심은 금물입니다.',
    monsterKeys: ['skeletonGrunt', 'direWolf'],
    bossKeys: ['alphaWolf'],
    resourceDrops: ['wood', 'herb', 'meat'],
    dropChance: 0.3,
  },
  zone2: {
    key: 'zone2',
    label: 'Zone 2',
    name: '어둠의 동굴',
    emoji: '⛰️',
    zoneType: 'yellow',
    minLevel: 11,
    recommendedLevel: '11-25',
    rewardStars: '⭐⭐',
    description: '암흑 마력이 흐르는 동굴. 전열 정비 없이 진입하면 위험합니다.',
    monsterKeys: ['undeadKnight', 'goblinShaman'],
    bossKeys: ['corruptedKnight'],
    resourceDrops: ['iron_ore', 'copper_ore', 'bone', 'leather'],
    dropChance: 0.35,
  },
  zone3: {
    key: 'zone3',
    label: 'Zone 3',
    name: '죽음의 산맥',
    emoji: '🏔️',
    zoneType: 'red',
    minLevel: 26,
    recommendedLevel: '26-50',
    rewardStars: '⭐⭐⭐',
    description: '영웅만이 살아남는 산맥. 강력한 보상만큼 치명적인 위험이 따릅니다.',
    monsterKeys: ['ancientDragon', 'lich'],
    bossKeys: ['youngDragon'],
    resourceDrops: ['silver_ore', 'gold_ore', 'rare_herb', 'fur'],
    dropChance: 0.4,
  },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getZone(zoneKey) {
  return ZONES[zoneKey] ?? null;
}

function listZoneChoices() {
  return Object.values(ZONES).map((zone) => ({
    name: `${zone.emoji} ${zone.name} (${zone.label}, Lv.${zone.minLevel}+)`,
    value: zone.key,
  }));
}

function listZones() {
  return Object.values(ZONES);
}

function spawnMonster(zoneKey) {
  const zone = getZone(zoneKey);

  if (!zone) {
    return null;
  }

  const randomKey = zone.monsterKeys[randomInt(0, zone.monsterKeys.length - 1)];
  const baseMonster = MONSTERS[randomKey];

  // 존별 능력치 배율 적용
  const zoneTypeData = ZONE_TYPES[zone.zoneType];
  const statMult = zoneTypeData ? zoneTypeData.statMultiplier : 1.0;
  const goldMult = zoneTypeData ? zoneTypeData.goldMultiplier : 1.0;
  const xpMult = zoneTypeData ? zoneTypeData.xpMultiplier : 1.0;

  return {
    ...baseMonster,
    hp: Math.floor(baseMonster.hp * statMult),
    attack: Math.floor(baseMonster.attack * statMult),
    defense: Math.floor(baseMonster.defense * statMult),
    xpReward: Math.floor(baseMonster.xpReward * xpMult),
    goldMin: Math.floor(baseMonster.goldMin * goldMult),
    goldMax: Math.floor(baseMonster.goldMax * goldMult),
  };
}

// 레어 몹 타입
const RARE_TYPES = {
  shiny: {
    name: '샤이니',
    emoji: '✨',
    chance: 0.01, // 1%
    hpMultiplier: 2.0,
    attackMultiplier: 1.5,
    defenseMultiplier: 1.3,
    xpMultiplier: 5.0,
    goldMultiplier: 10.0,
    prefix: '빛나는',
  },
  boss: {
    name: '보스',
    emoji: '👑',
    chance: 0.05, // 5%
    hpMultiplier: 3.0,
    attackMultiplier: 2.0,
    defenseMultiplier: 1.5,
    xpMultiplier: 3.0,
    goldMultiplier: 5.0,
    prefix: '강력한',
  },
};

// 레어 몹 체크 (존별 확률 조정)
function rollRareMonster(zoneKey = null) {
  // 존별 레어 확률 배율
  let rareMult = 1.0;
  if (zoneKey) {
    const zone = getZone(zoneKey);
    if (zone && zone.zoneType && ZONE_TYPES[zone.zoneType]) {
      rareMult = ZONE_TYPES[zone.zoneType].rareChanceMultiplier;
    }
  }

  const roll = Math.random();

  // 샤이니 체크 (1% × 존 배율)
  const shinyChance = RARE_TYPES.shiny.chance * rareMult;
  if (roll < shinyChance) {
    return 'shiny';
  }

  // 보스 체크 (5% × 존 배율)
  const bossChance = RARE_TYPES.boss.chance * rareMult;
  if (roll < shinyChance + bossChance) {
    return 'boss';
  }

  return null; // 일반 몬스터
}

// 레어 몬스터 생성
function applyRareModifier(monster, rareType) {
  if (!rareType || !RARE_TYPES[rareType]) {
    return { ...monster, rareType: null };
  }

  const modifier = RARE_TYPES[rareType];

  return {
    ...monster,
    name: `${modifier.prefix} ${monster.name}`,
    displayName: `${modifier.emoji} ${modifier.prefix} ${monster.name}`,
    hp: Math.floor(monster.hp * modifier.hpMultiplier),
    attack: Math.floor(monster.attack * modifier.attackMultiplier),
    defense: Math.floor(monster.defense * modifier.defenseMultiplier),
    xpReward: Math.floor(monster.xpReward * modifier.xpMultiplier),
    goldMin: Math.floor(monster.goldMin * modifier.goldMultiplier),
    goldMax: Math.floor(monster.goldMax * modifier.goldMultiplier),
    rareType,
    rareEmoji: modifier.emoji,
  };
}

// 존 정보 조회 (타입 데이터 포함)
function getZoneWithTypeData(zoneKey) {
  const zone = getZone(zoneKey);
  if (!zone) return null;

  const zoneTypeData = ZONE_TYPES[zone.zoneType];
  return {
    ...zone,
    typeData: zoneTypeData,
  };
}

module.exports = {
  MONSTERS,
  ZONES,
  ZONE_TYPES,
  RARE_TYPES,
  randomInt,
  getZone,
  getZoneWithTypeData,
  listZones,
  listZoneChoices,
  spawnMonster,
  rollRareMonster,
  applyRareModifier,
};
