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
};

const ZONES = {
  zone1: {
    key: 'zone1',
    label: 'Zone 1',
    name: '초보자 숲',
    emoji: '🌲',
    minLevel: 1,
    recommendedLevel: '1-10',
    rewardStars: '⭐',
    description: '첫 모험가를 위한 숲. 비교적 안전하지만 방심은 금물입니다.',
    monsterKeys: ['skeletonGrunt', 'direWolf'],
  },
  zone2: {
    key: 'zone2',
    label: 'Zone 2',
    name: '어둠의 동굴',
    emoji: '⛰️',
    minLevel: 11,
    recommendedLevel: '11-25',
    rewardStars: '⭐⭐',
    description: '암흑 마력이 흐르는 동굴. 전열 정비 없이 진입하면 위험합니다.',
    monsterKeys: ['undeadKnight', 'goblinShaman'],
  },
  zone3: {
    key: 'zone3',
    label: 'Zone 3',
    name: '죽음의 산맥',
    emoji: '🏔️',
    minLevel: 26,
    recommendedLevel: '26-50',
    rewardStars: '⭐⭐⭐',
    description: '영웅만이 살아남는 산맥. 강력한 보상만큼 치명적인 위험이 따릅니다.',
    monsterKeys: ['ancientDragon', 'lich'],
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

  return {
    ...baseMonster,
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

// 레어 몹 체크
function rollRareMonster() {
  const roll = Math.random();

  // 샤이니 체크 (1%)
  if (roll < RARE_TYPES.shiny.chance) {
    return 'shiny';
  }

  // 보스 체크 (5%)
  if (roll < RARE_TYPES.shiny.chance + RARE_TYPES.boss.chance) {
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

module.exports = {
  MONSTERS,
  ZONES,
  RARE_TYPES,
  randomInt,
  getZone,
  listZones,
  listZoneChoices,
  spawnMonster,
  rollRareMonster,
  applyRareModifier,
};
