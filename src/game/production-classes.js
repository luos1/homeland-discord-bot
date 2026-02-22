// 생산 클래스 정의

const PRODUCTION_CLASSES = {
  // 채집 계열
  miner: {
    key: 'miner',
    name: '광부',
    emoji: '🪨',
    category: 'gathering',
    description: '광석과 보석을 채굴합니다',
    gatherTypes: ['iron_ore', 'copper_ore', 'silver_ore', 'gold_ore', 'gem'],
    baseGatherTime: 1800, // 30분 (초 단위)
    levelBonus: {
      gatherSpeed: 0.05, // 레벨당 5% 속도 증가
      quantity: 0.1, // 레벨당 10% 수량 증가
    },
  },
  herbalist: {
    key: 'herbalist',
    name: '약초꾼',
    emoji: '🌿',
    category: 'gathering',
    description: '허브와 약재를 채집합니다',
    gatherTypes: ['herb', 'medicinal_herb', 'rare_herb', 'magic_herb'],
    baseGatherTime: 1500, // 25분
    levelBonus: {
      gatherSpeed: 0.05,
      quantity: 0.1,
    },
  },
  lumberjack: {
    key: 'lumberjack',
    name: '벌목꾼',
    emoji: '🪓',
    category: 'gathering',
    description: '나무를 베어 목재를 얻습니다',
    gatherTypes: ['wood', 'hardwood', 'rare_wood', 'magic_wood'],
    baseGatherTime: 1200, // 20분
    levelBonus: {
      gatherSpeed: 0.05,
      quantity: 0.1,
    },
  },
  fisher: {
    key: 'fisher',
    name: '어부',
    emoji: '🎣',
    category: 'gathering',
    description: '물고기와 해산물을 잡습니다',
    gatherTypes: ['fish', 'rare_fish', 'seafood', 'pearl'],
    baseGatherTime: 1800, // 30분
    levelBonus: {
      gatherSpeed: 0.05,
      quantity: 0.1,
    },
  },
  hunter: {
    key: 'hunter',
    name: '사냥꾼',
    emoji: '🐾',
    category: 'gathering',
    description: '동물을 사냥하여 가죽과 고기를 얻습니다',
    gatherTypes: ['leather', 'meat', 'fur', 'bone'],
    baseGatherTime: 2400, // 40분
    levelBonus: {
      gatherSpeed: 0.05,
      quantity: 0.1,
    },
  },

  // 제작 계열
  blacksmith: {
    key: 'blacksmith',
    name: '대장장이',
    emoji: '🔨',
    category: 'crafting',
    description: '무기와 방어구를 제작합니다',
    craftTypes: ['weapon', 'armor'],
    baseCraftTime: 3600, // 60분
    levelBonus: {
      craftSpeed: 0.05,
      quality: 0.02, // 레벨당 2% 품질 향상
    },
  },
  alchemist: {
    key: 'alchemist',
    name: '연금술사',
    emoji: '🧪',
    category: 'crafting',
    description: '포션과 스크롤을 제작합니다',
    craftTypes: ['potion', 'scroll'],
    baseCraftTime: 1800, // 30분
    levelBonus: {
      craftSpeed: 0.05,
      quality: 0.02,
    },
  },
  tailor: {
    key: 'tailor',
    name: '재봉사',
    emoji: '🧵',
    category: 'crafting',
    description: '의류와 가방을 제작합니다',
    craftTypes: ['cloth', 'bag'],
    baseCraftTime: 2400, // 40분
    levelBonus: {
      craftSpeed: 0.05,
      quality: 0.02,
    },
  },
  chef: {
    key: 'chef',
    name: '요리사',
    emoji: '🍳',
    category: 'crafting',
    description: '음식과 버프를 만듭니다',
    craftTypes: ['food', 'buff_food'],
    baseCraftTime: 1200, // 20분
    levelBonus: {
      craftSpeed: 0.05,
      quality: 0.02,
    },
  },
};

// 자원 정의
const RESOURCES = {
  // 광석
  iron_ore: { name: '철광석', emoji: '🪨', tier: 1, gatherClass: 'miner' },
  copper_ore: { name: '구리광석', emoji: '🟤', tier: 1, gatherClass: 'miner' },
  silver_ore: { name: '은광석', emoji: '⚪', tier: 2, gatherClass: 'miner' },
  gold_ore: { name: '금광석', emoji: '🟡', tier: 3, gatherClass: 'miner' },
  gem: { name: '보석', emoji: '💎', tier: 4, gatherClass: 'miner' },

  // 허브
  herb: { name: '허브', emoji: '🌿', tier: 1, gatherClass: 'herbalist' },
  medicinal_herb: { name: '약초', emoji: '🌱', tier: 2, gatherClass: 'herbalist' },
  rare_herb: { name: '희귀 약초', emoji: '🍀', tier: 3, gatherClass: 'herbalist' },
  magic_herb: { name: '마법 허브', emoji: '✨', tier: 4, gatherClass: 'herbalist' },

  // 목재
  wood: { name: '목재', emoji: '🪵', tier: 1, gatherClass: 'lumberjack' },
  hardwood: { name: '단단한 목재', emoji: '🌳', tier: 2, gatherClass: 'lumberjack' },
  rare_wood: { name: '희귀 목재', emoji: '🌲', tier: 3, gatherClass: 'lumberjack' },
  magic_wood: { name: '마법 목재', emoji: '🎄', tier: 4, gatherClass: 'lumberjack' },

  // 물고기
  fish: { name: '물고기', emoji: '🐟', tier: 1, gatherClass: 'fisher' },
  rare_fish: { name: '희귀 물고기', emoji: '🐠', tier: 2, gatherClass: 'fisher' },
  seafood: { name: '해산물', emoji: '🦐', tier: 2, gatherClass: 'fisher' },
  pearl: { name: '진주', emoji: '🫧', tier: 4, gatherClass: 'fisher' },

  // 사냥 자원
  leather: { name: '가죽', emoji: '🦌', tier: 1, gatherClass: 'hunter' },
  meat: { name: '고기', emoji: '🥩', tier: 1, gatherClass: 'hunter' },
  fur: { name: '모피', emoji: '🐺', tier: 2, gatherClass: 'hunter' },
  bone: { name: '뼈', emoji: '🦴', tier: 2, gatherClass: 'hunter' },
};

// 레시피 정의
const RECIPES = {
  iron_sword: {
    key: 'iron_sword',
    name: '철 검',
    emoji: '⚔️',
    type: 'weapon',
    craftClass: 'blacksmith',
    craftTime: 3600, // 60분
    materials: {
      iron_ore: 5,
      wood: 2,
    },
    result: {
      type: 'equipment',
      rarity: 'common',
      attack: 10,
      defense: 0,
    },
  },
  health_potion: {
    key: 'health_potion',
    name: '체력 회복 포션',
    emoji: '💊',
    type: 'potion',
    craftClass: 'alchemist',
    craftTime: 1800, // 30분
    materials: {
      herb: 3,
      water: 1,
    },
    result: {
      type: 'consumable',
      effect: 'heal',
      power: 50,
    },
  },
  // 추가 레시피는 나중에...
};

// 생산 클래스 목록 반환
function getProductionClassList() {
  return Object.values(PRODUCTION_CLASSES);
}

// 채집 클래스만 반환
function getGatheringClasses() {
  return Object.values(PRODUCTION_CLASSES).filter((c) => c.category === 'gathering');
}

// 제작 클래스만 반환
function getCraftingClasses() {
  return Object.values(PRODUCTION_CLASSES).filter((c) => c.category === 'crafting');
}

// 클래스로 채집 가능한 자원 반환
function getGatherableResources(productionClass) {
  const classData = PRODUCTION_CLASSES[productionClass];
  if (!classData || !classData.gatherTypes) return [];

  return classData.gatherTypes.map((type) => ({
    type,
    ...RESOURCES[type],
  }));
}

// 채집 시간 계산 (레벨 보너스 적용)
function calculateGatherTime(productionClass, productionLevel) {
  const classData = PRODUCTION_CLASSES[productionClass];
  if (!classData) return 1800;

  const baseTime = classData.baseGatherTime;
  const speedBonus = classData.levelBonus.gatherSpeed * (productionLevel - 1);
  const finalTime = Math.floor(baseTime * (1 - speedBonus));

  return Math.max(finalTime, 300); // 최소 5분
}

// 채집 수량 계산 (레벨 보너스 적용)
function calculateGatherQuantity(productionClass, productionLevel, resourceTier) {
  const classData = PRODUCTION_CLASSES[productionClass];
  if (!classData) return 1;

  const baseQuantity = Math.max(1, 5 - resourceTier); // 낮은 티어일수록 많이
  const quantityBonus = classData.levelBonus.quantity * (productionLevel - 1);
  const finalQuantity = Math.floor(baseQuantity * (1 + quantityBonus));

  return Math.max(finalQuantity, 1);
}

module.exports = {
  PRODUCTION_CLASSES,
  RESOURCES,
  RECIPES,
  getProductionClassList,
  getGatheringClasses,
  getCraftingClasses,
  getGatherableResources,
  calculateGatherTime,
  calculateGatherQuantity,
};
