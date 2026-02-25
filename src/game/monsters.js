// 몬스터 이미지 URL (임시 - 나중에 실제 이미지로 교체)
const MONSTER_IMAGES = {
  skeletonGrunt: 'https://via.placeholder.com/512/808080/FFFFFF?text=Skeleton',
  direWolf: 'https://via.placeholder.com/512/8B4513/FFFFFF?text=Wolf',
  undeadKnight: 'https://via.placeholder.com/512/4B0082/FFFFFF?text=Knight',
  goblinShaman: 'https://via.placeholder.com/512/228B22/FFFFFF?text=Goblin',
  ancientDragon: 'https://via.placeholder.com/512/FF4500/FFFFFF?text=Dragon',
  lich: 'https://via.placeholder.com/512/8B008B/FFFFFF?text=Lich',
  voidStalker: 'https://via.placeholder.com/512/000000/FFFFFF?text=Void',
  abyssSentinel: 'https://via.placeholder.com/512/191970/FFFFFF?text=Abyss',
  cursedTemplar: 'https://via.placeholder.com/512/DC143C/FFFFFF?text=Templar',
  stormHarpy: 'https://via.placeholder.com/512/87CEEB/FFFFFF?text=Harpy',
  flameTitan: 'https://via.placeholder.com/512/FF6347/FFFFFF?text=Titan',
  ancientGuardian: 'https://via.placeholder.com/512/2F4F4F/FFFFFF?text=Guardian',
};

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
    imageUrl: MONSTER_IMAGES.skeletonGrunt,
    patterns: [
      { phase: 0, name: '뼈 검 공격', attackMultiplier: 1.0, description: '녹슨 검을 휘두릅니다' },
      { phase: 1, name: '광란의 연타', attackMultiplier: 1.3, warn: '⚔️ 연속 공격 준비!', description: '공격력 1.3배' },
    ],
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
    imageUrl: MONSTER_IMAGES.direWolf,
    patterns: [
      { phase: 0, name: '견제 공격', attackMultiplier: 0.7, description: '가볍게 견제합니다' },
      { phase: 1, name: '울부짖음', attackMultiplier: 0, warn: '⚠️ 다음 턴 강공격 예고!', description: '강공격 준비 중' },
      { phase: 2, name: '맹렬한 돌진', attackMultiplier: 2.0, description: '강력한 돌진 공격!' },
    ],
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
    imageUrl: MONSTER_IMAGES.undeadKnight,
    patterns: [
      { phase: 0, name: '검 공격', attackMultiplier: 1.0, description: '검을 휘두릅니다' },
      { phase: 1, name: '방어 태세', attackMultiplier: 0.5, defenseBoost: 1.5, warn: '🛡️ 방어 태세 전환!', description: '데미지 50% 감소' },
      { phase: 2, name: '광폭화', attackMultiplier: 1.5, defenseBoost: 0, warn: '💢 광폭화! 방어력 0!', description: '공격력 1.5배, 방어력 0' },
    ],
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
    imageUrl: MONSTER_IMAGES.goblinShaman,
    patterns: [
      { phase: 0, name: '마법 공격', attackMultiplier: 1.0, description: '마법 에너지를 발사합니다' },
      { phase: 1, name: '방어막 소환', attackMultiplier: 0.5, defenseBoost: 2.0, warn: '🛡️ 방어막 전개!', description: '방어력 2배 증가' },
      { phase: 2, name: '자폭 준비', attackMultiplier: 0, warn: '💀 다음 턴 자폭 예고!', description: '자폭 카운트다운' },
      { phase: 3, name: '마법 폭발', attackMultiplier: 2.5, selfDamage: 0.5, description: '자폭 공격!' },
    ],
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
    imageUrl: MONSTER_IMAGES.ancientDragon,
    patterns: [
      { phase: 0, name: '발톱 공격', attackMultiplier: 1.0, description: '날카로운 발톱으로 공격' },
      { phase: 1, name: '화염 충전', attackMultiplier: 0.3, warn: '🔥 화염 준비 중!', description: '화염 브레스 준비' },
      { phase: 2, name: '화염 브레스', attackMultiplier: 2.2, description: '뜨거운 화염을 내뿜습니다!' },
    ],
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
    imageUrl: MONSTER_IMAGES.lich,
    patterns: [
      { phase: 0, name: '암흑 마법', attackMultiplier: 1.0, description: '어둠의 에너지를 발사' },
      { phase: 1, name: '생명력 흡수', attackMultiplier: 0.8, heal: 0.3, warn: '💀 생명력 흡수!', description: '공격력 0.8배, 데미지의 30% 회복' },
      { phase: 2, name: '사령 소환', attackMultiplier: 1.5, warn: '👻 사령 소환!', description: '사령과 함께 공격' },
    ],
  },
  voidStalker: {
    name: '공허 추적자',
    level: 40,
    hp: 158,
    attack: 33,
    defense: 13,
    xpReward: 132,
    goldMin: 96,
    goldMax: 138,
    trait: '은신 상태에서 기습적인 일격을 가합니다.',
    imageUrl: MONSTER_IMAGES.voidStalker,
    patterns: [
      { phase: 0, name: '은신', attackMultiplier: 0, warn: '🌫️ 은신! 위치 파악 불가!', description: '은신 상태' },
      { phase: 1, name: '기습 공격', attackMultiplier: 2.5, description: '은신에서 기습!' },
      { phase: 2, name: '일반 공격', attackMultiplier: 1.0, description: '일반 공격' },
    ],
  },
  abyssSentinel: {
    name: '심연 감시자',
    level: 46,
    hp: 186,
    attack: 38,
    defense: 18,
    xpReward: 148,
    goldMin: 108,
    goldMax: 162,
    trait: '높은 방어력으로 정면 교전을 선호합니다.',
    imageUrl: MONSTER_IMAGES.abyssSentinel,
    patterns: [
      { phase: 0, name: '방패 타격', attackMultiplier: 1.0, description: '무거운 방패로 타격' },
      { phase: 1, name: '철벽 방어', attackMultiplier: 0.3, defenseBoost: 2.5, warn: '🛡️ 철벽 방어!', description: '방어력 2.5배' },
      { phase: 2, name: '방패 돌진', attackMultiplier: 1.8, description: '방패를 들고 돌진!' },
    ],
  },
  cursedTemplar: {
    name: '저주받은 성기사',
    level: 52,
    hp: 214,
    attack: 43,
    defense: 21,
    xpReward: 168,
    goldMin: 124,
    goldMax: 188,
    trait: '광역 충격파로 전열을 무너뜨립니다.',
    imageUrl: MONSTER_IMAGES.cursedTemplar,
    patterns: [
      { phase: 0, name: '성검 공격', attackMultiplier: 1.0, description: '성스러운 검 공격' },
      { phase: 1, name: '저주의 힘', attackMultiplier: 1.3, warn: '💀 저주 충전!', description: '어둠의 힘 충전' },
      { phase: 2, name: '충격파', attackMultiplier: 2.0, description: '강력한 충격파 발동!' },
    ],
  },
  stormHarpy: {
    name: '폭풍 하피',
    level: 58,
    hp: 198,
    attack: 49,
    defense: 16,
    xpReward: 184,
    goldMin: 142,
    goldMax: 208,
    trait: '급강하 후 연속 공격으로 압박합니다.',
    imageUrl: MONSTER_IMAGES.stormHarpy,
    patterns: [
      { phase: 0, name: '바람 공격', attackMultiplier: 1.0, description: '바람 날개로 공격' },
      { phase: 1, name: '상승', attackMultiplier: 0, warn: '🌪️ 급강하 준비!', description: '하늘로 상승' },
      { phase: 2, name: '급강하 연타', attackMultiplier: 2.3, description: '급강하 연속 공격!' },
    ],
  },
  twilightBehemoth: {
    name: '황혼의 베히모스',
    level: 65,
    hp: 268,
    attack: 54,
    defense: 24,
    xpReward: 216,
    goldMin: 176,
    goldMax: 248,
    trait: '느리지만 한 방이 매우 강력합니다.',
    imageUrl: MONSTER_IMAGES.flameTitan,
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
    imageUrl: MONSTER_IMAGES.direWolf,
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
    imageUrl: MONSTER_IMAGES.undeadKnight,
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
    imageUrl: MONSTER_IMAGES.ancientDragon,
  },

  shadowOverlord: {
    name: '🦇 그림자 군주',
    level: 60,
    hp: 2200,
    attack: 80,
    defense: 34,
    xpReward: 980,
    goldMin: 900,
    goldMax: 1350,
    isBoss: true,
    bossType: 'field',
    guaranteedDrop: {
      rarity: 'rare+',
      minRarity: 'rare',
      chance: 1.0,
    },
    description: '폐허의 중앙을 지배하는 심연의 지휘관',
    skillPatterns: [
      {
        name: '그림자 과충전',
        trigger: 'every_3_turns',
        value: 3,
        effect: 'flat_damage',
        amount: 45,
        description: '3턴마다 추가 암흑 피해를 입힙니다.',
      },
      {
        name: '심연 광폭화',
        trigger: 'hp_below',
        value: 50,
        effect: 'attack_multiplier',
        amount: 1.4,
        description: '체력 50% 이하에서 공격력이 크게 증가합니다.',
      },
    ],
  },

  eclipseTitan: {
    name: '🌘 이클립스 타이탄',
    level: 65,
    hp: 2850,
    attack: 90,
    defense: 42,
    xpReward: 1220,
    goldMin: 1200,
    goldMax: 1700,
    isBoss: true,
    bossType: 'field',
    guaranteedDrop: {
      rarity: 'rare+',
      minRarity: 'rare',
      chance: 1.0,
    },
    description: '붕괴한 요새를 떠도는 거대한 황혼의 수호자',
    skillPatterns: [
      {
        name: '파멸의 낙인',
        trigger: 'player_hp_below',
        value: 35,
        effect: 'flat_damage',
        amount: 55,
        description: '대상의 체력이 낮을수록 추가 피해를 가합니다.',
      },
      {
        name: '황혼의 재생',
        trigger: 'cross_hp_below',
        value: 40,
        effect: 'heal',
        amount: 320,
        description: '체력 40% 구간 진입 시 한 번 대량 회복합니다.',
      },
      {
        name: '종말의 분노',
        trigger: 'hp_below',
        value: 25,
        effect: 'attack_multiplier',
        amount: 1.55,
        description: '체력 25% 이하에서 공격력이 폭증합니다.',
      },
    ],

  // 숨겨진 던전 보스
  ancientGuardian: {
    name: '🗿 고대의 수호자',
    level: 15,
    hp: 800,
    attack: 35,
    defense: 20,
    xpReward: 400,
    goldMin: 500,
    goldMax: 1000,
    isBoss: true,
    bossType: 'hidden',
    guaranteedDrop: {
      rarity: 'legendary',
      chance: 1.0,
    },
    description: '오랜 세월 비밀 통로를 지키고 있던 고대의 전사. 던전 10층 클리어 후 1% 확률로 등장.',
    imageUrl: MONSTER_IMAGES.ancientGuardian,
    skillPatterns: [
      {
        name: '고대의 분노',
        trigger: 'every_3_turns',
        value: 3,
        effect: 'flat_damage',
        amount: 60,
        description: '3턴마다 강력한 일격을 가합니다.',
      },
      {
        name: '수호자의 힘',
        trigger: 'hp_below',
        value: 50,
        effect: 'attack_multiplier',
        amount: 1.5,
        description: '체력 50% 이하에서 공격력이 1.5배 증가합니다.',
      },
    ],
  },
  },
};

// 존 타입 정의
const ZONE_TYPES = {
  blue: {
    name: '안전지대',
    emoji: '🔵',
    color: 0x3b82f6,
    rareChanceMultiplier: 1.0, // 레어 확률 고정 (샤이니 1%, 보스 5%)
    statMultiplier: 1.0, // 능력치 1배
    goldMultiplier: 1.0,
    xpMultiplier: 1.0,
    description: 'PvP 없음, 초보자 구역',
  },
  yellow: {
    name: '경계지대',
    emoji: '🟡',
    color: 0xeab308,
    rareChanceMultiplier: 1.0, // 레어 확률 고정
    statMultiplier: 1.5, // 능력치 1.5배
    goldMultiplier: 1.3,
    xpMultiplier: 1.4,
    description: 'PvP 연습 구역, 중급 난이도',
  },
  red: {
    name: '위험지대',
    emoji: '🔴',
    color: 0xef4444,
    rareChanceMultiplier: 1.0, // 레어 확률 고정
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
    specialMechanic: '⚠️ **특수 메커니즘**\n몬스터가 첫 턴에 먼저 공격합니다!\n체력 관리에 주의하세요.',
  },
  zone4: {
    key: 'zone4',
    label: 'Zone 4',
    name: '황혼의 폐허',
    emoji: '🕳️',
    zoneType: 'yellow',
    minLevel: 40,
    recommendedLevel: '40-65',
    rewardStars: '⭐⭐⭐⭐',
    description: '무너진 성채와 균열이 이어진 전장. 강력한 엘리트와 보스가 순찰합니다.',
    monsterKeys: ['voidStalker', 'abyssSentinel', 'cursedTemplar', 'stormHarpy', 'twilightBehemoth'],
    bossKeys: ['shadowOverlord', 'eclipseTitan'],
    resourceDrops: ['gem', 'magic_herb', 'magic_wood', 'pearl', 'rare_fish'],
    dropChance: 0.45,
    specialMechanic: '⚠️ **필드 보스 메커니즘**\nZone 4 보스는 체력/턴 조건에 따라 특수 스킬을 사용합니다.',
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
    defenseMultiplier: 1.0,
    xpMultiplier: 5.0,
    goldMultiplier: 10.0,
    prefix: '샤이니',
    legacyPrefixes: ['빛나는'],
  },
  boss: {
    name: '보스',
    emoji: '👑',
    chance: 0.05, // 5%
    hpMultiplier: 3.0,
    attackMultiplier: 2.0,
    defenseMultiplier: 1.0,
    xpMultiplier: 3.0,
    goldMultiplier: 5.0,
    prefix: '보스',
    legacyPrefixes: ['강력한'],
  },
};

// 레어 몹 체크 (샤이니 1%, 보스 5%)
function rollRareMonster(_zoneKey = null) {
  const roll = Math.random();

  const shinyChance = RARE_TYPES.shiny.chance;
  if (roll < shinyChance) {
    return 'shiny';
  }

  const bossChance = RARE_TYPES.boss.chance;
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
  const defenseMultiplier = Number.isFinite(modifier.defenseMultiplier)
    ? modifier.defenseMultiplier
    : 1;
  const prefixedName = `${modifier.prefix} ${monster.name}`;

  return {
    ...monster,
    name: prefixedName,
    displayName: `${modifier.emoji} ${prefixedName}`,
    hp: Math.floor(monster.hp * modifier.hpMultiplier),
    attack: Math.floor(monster.attack * modifier.attackMultiplier),
    defense: Math.max(1, Math.floor(monster.defense * defenseMultiplier)),
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
