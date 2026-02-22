// 필드 보스 데이터

const BOSS_DATA = {
  alpha_wolf: {
    id: 'alpha_wolf',
    name: '알파 울프',
    emoji: '🐺',
    zone: 1,
    level: 10,
    hp: 300,
    attack: 25,
    defense: 15,
    xpReward: 150,
    goldReward: { min: 200, max: 300 },
    respawnMinutes: 120, // 2시간
    description: '초보자 숲을 지배하는 무리의 우두머리',
    skills: [
      {
        name: '광폭화',
        description: '체력이 50% 이하일 때 공격력 +50%',
        trigger: 'hp_below_50',
        effect: 'attack_boost',
        value: 0.5,
      },
      {
        name: '무리 소환',
        description: '3턴마다 늑대 무리를 소환하여 추가 공격',
        trigger: 'every_3_turns',
        effect: 'extra_damage',
        value: 20,
      },
    ],
    dropTable: {
      equipment: {
        guaranteed: true,
        minRarity: 'rare', // 최소 희귀
        maxRarity: 'epic',
        goldMultiplier: 2.5,
      },
      skillBook: {
        chance: 0.10, // 10%
        classRestriction: 'any', // 플레이어 클래스에 맞는 스킬
      },
    },
  },

  fallen_knight: {
    id: 'fallen_knight',
    name: '타락한 기사',
    emoji: '⚔️',
    zone: 2,
    level: 20,
    hp: 600,
    attack: 40,
    defense: 30,
    xpReward: 350,
    goldReward: { min: 400, max: 600 },
    respawnMinutes: 120,
    description: '한때 영웅이었으나 어둠에 타락한 기사',
    skills: [
      {
        name: '방어 태세',
        description: '체력이 70% 이상일 때 받는 피해 -40%',
        trigger: 'hp_above_70',
        effect: 'damage_reduction',
        value: 0.4,
      },
      {
        name: '강타',
        description: '4턴마다 강력한 일격 (데미지 x2)',
        trigger: 'every_4_turns',
        effect: 'power_strike',
        value: 2.0,
      },
      {
        name: '어둠의 재생',
        description: '5턴마다 HP 100 회복',
        trigger: 'every_5_turns',
        effect: 'heal',
        value: 100,
      },
    ],
    dropTable: {
      equipment: {
        guaranteed: true,
        minRarity: 'rare',
        maxRarity: 'epic',
        goldMultiplier: 3.0,
      },
      skillBook: {
        chance: 0.12,
        classRestriction: 'any',
      },
    },
  },

  young_dragon: {
    id: 'young_dragon',
    name: '어린 드래곤',
    emoji: '🐉',
    zone: 3,
    level: 35,
    hp: 1200,
    attack: 60,
    defense: 40,
    xpReward: 800,
    goldReward: { min: 800, max: 1200 },
    respawnMinutes: 180, // 3시간
    description: '아직 성체가 되지 않았지만 강력한 드래곤',
    skills: [
      {
        name: '화염 브레스',
        description: '3턴마다 강력한 화염 공격 (데미지 x2.5)',
        trigger: 'every_3_turns',
        effect: 'breath_attack',
        value: 2.5,
      },
      {
        name: '용의 비늘',
        description: '체력이 80% 이상일 때 받는 피해 -50%',
        trigger: 'hp_above_80',
        effect: 'damage_reduction',
        value: 0.5,
      },
      {
        name: '비행',
        description: '5턴마다 회피하여 공격 무효화',
        trigger: 'every_5_turns',
        effect: 'dodge',
        value: 1.0,
      },
      {
        name: '용의 분노',
        description: '체력이 30% 이하일 때 공격력 +100%',
        trigger: 'hp_below_30',
        effect: 'attack_boost',
        value: 1.0,
      },
    ],
    dropTable: {
      equipment: {
        guaranteed: true,
        minRarity: 'epic',
        maxRarity: 'epic',
        goldMultiplier: 3.5,
      },
      skillBook: {
        chance: 0.15,
        classRestriction: 'any',
      },
      legendaryMaterial: {
        chance: 0.05, // 5% (나중에 구현)
        items: ['dragon_scale', 'dragon_fang'],
      },
    },
  },
};

// 지역별 보스 매핑
const BOSSES_BY_ZONE = {
  1: ['alpha_wolf'],
  2: ['fallen_knight'],
  3: ['young_dragon'],
};

function getBossByZone(zone) {
  const bossIds = BOSSES_BY_ZONE[zone];
  if (!bossIds || bossIds.length === 0) return null;

  return bossIds.map((id) => BOSS_DATA[id]);
}

function getBossById(bossId) {
  return BOSS_DATA[bossId] || null;
}

function getAllBosses() {
  return Object.values(BOSS_DATA);
}

module.exports = {
  BOSS_DATA,
  BOSSES_BY_ZONE,
  getBossByZone,
  getBossById,
  getAllBosses,
};
