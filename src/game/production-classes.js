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
  // 대장장이 - 무기
  iron_sword: {
    key: 'iron_sword',
    name: '철 검',
    emoji: '⚔️',
    type: 'weapon',
    craftClass: 'blacksmith',
    craftTime: 1800, // 30분
    requiredLevel: 1,
    materials: {
      iron_ore: 5,
      wood: 2,
    },
    result: {
      type: 'equipment',
      equipmentType: 'weapon',
      rarity: 'common',
      attack: 8,
      defense: 0,
    },
  },
  steel_sword: {
    key: 'steel_sword',
    name: '강철 검',
    emoji: '⚔️',
    type: 'weapon',
    craftClass: 'blacksmith',
    craftTime: 3600, // 60분
    requiredLevel: 3,
    materials: {
      iron_ore: 10,
      silver_ore: 3,
      hardwood: 3,
    },
    result: {
      type: 'equipment',
      equipmentType: 'weapon',
      rarity: 'uncommon',
      attack: 15,
      defense: 0,
    },
  },
  
  // 대장장이 - 방어구
  iron_armor: {
    key: 'iron_armor',
    name: '철 갑옷',
    emoji: '🛡️',
    type: 'armor',
    craftClass: 'blacksmith',
    craftTime: 2400, // 40분
    requiredLevel: 2,
    materials: {
      iron_ore: 8,
      leather: 4,
    },
    result: {
      type: 'equipment',
      equipmentType: 'armor',
      rarity: 'common',
      attack: 0,
      defense: 10,
      hp: 15,
    },
  },

  // 연금술사 - 포션
  health_potion: {
    key: 'health_potion',
    name: '체력 회복 포션',
    emoji: '💊',
    type: 'potion',
    craftClass: 'alchemist',
    craftTime: 900, // 15분
    requiredLevel: 1,
    materials: {
      herb: 3,
    },
    result: {
      type: 'consumable',
      effect: 'heal_hp',
      power: 50,
    },
  },
  mana_potion: {
    key: 'mana_potion',
    name: '마나 회복 포션',
    emoji: '🧪',
    type: 'potion',
    craftClass: 'alchemist',
    craftTime: 900, // 15분
    requiredLevel: 1,
    materials: {
      herb: 3,
    },
    result: {
      type: 'consumable',
      effect: 'heal_mp',
      power: 30,
    },
  },
  greater_health_potion: {
    key: 'greater_health_potion',
    name: '상급 체력 포션',
    emoji: '💊',
    type: 'potion',
    craftClass: 'alchemist',
    craftTime: 1800, // 30분
    requiredLevel: 3,
    materials: {
      medicinal_herb: 5,
      rare_herb: 2,
    },
    result: {
      type: 'consumable',
      effect: 'heal_hp',
      power: 100,
    },
  },

  // 재봉사 - 의류
  leather_gloves: {
    key: 'leather_gloves',
    name: '가죽 장갑',
    emoji: '🧤',
    type: 'cloth',
    craftClass: 'tailor',
    craftTime: 1200, // 20분
    requiredLevel: 1,
    materials: {
      leather: 4,
    },
    result: {
      type: 'equipment',
      equipmentType: 'accessory',
      rarity: 'common',
      attack: 3,
      defense: 2,
    },
  },
  fur_coat: {
    key: 'fur_coat',
    name: '모피 코트',
    emoji: '🧥',
    type: 'cloth',
    craftClass: 'tailor',
    craftTime: 2400, // 40분
    requiredLevel: 2,
    materials: {
      fur: 6,
      leather: 3,
    },
    result: {
      type: 'equipment',
      equipmentType: 'armor',
      rarity: 'uncommon',
      attack: 0,
      defense: 12,
      hp: 20,
    },
  },

  // 요리사 - 음식
  grilled_meat: {
    key: 'grilled_meat',
    name: '구운 고기',
    emoji: '🍖',
    type: 'food',
    craftClass: 'chef',
    craftTime: 600, // 10분
    requiredLevel: 1,
    materials: {
      meat: 2,
    },
    result: {
      type: 'consumable',
      effect: 'heal_hp',
      power: 30,
    },
  },
  fish_stew: {
    key: 'fish_stew',
    name: '생선 스튜',
    emoji: '🍲',
    type: 'food',
    craftClass: 'chef',
    craftTime: 1200, // 20분
    requiredLevel: 2,
    materials: {
      fish: 3,
      herb: 2,
    },
    result: {
      type: 'consumable',
      effect: 'buff_regen',
      power: 5,
      duration: 3600, // 1시간
    },
  },
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

// 클래스로 제작 가능한 레시피 반환
function getCraftableRecipes(productionClass, productionLevel) {
  return Object.values(RECIPES).filter((recipe) => {
    return recipe.craftClass === productionClass && recipe.requiredLevel <= productionLevel;
  });
}

// 제작 시간 계산 (레벨 보너스 적용)
function calculateCraftTime(productionClass, productionLevel, baseTime) {
  const classData = PRODUCTION_CLASSES[productionClass];
  if (!classData) return baseTime;

  const speedBonus = classData.levelBonus.craftSpeed * (productionLevel - 1);
  const finalTime = Math.floor(baseTime * (1 - speedBonus));

  return Math.max(finalTime, 300); // 최소 5분
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
  getCraftableRecipes,
  calculateCraftTime,
};
