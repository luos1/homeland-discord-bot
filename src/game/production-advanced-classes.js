// 생산 직업 고급 클래스 (레벨 5 전직)

const PRODUCTION_ADVANCED_CLASSES = {
  // 채집 계열
  miner: {
    gemcutter: {
      key: 'gemcutter',
      name: '보석 세공사',
      emoji: '💎',
      description: '보석과 희귀 광물 전문. 보석 채집량 +30%',
      bonuses: {
        gatherSpeed: 0.1, // +10% 속도
        gemQuantity: 0.3, // 보석 +30%
      },
    },
    master_miner: {
      key: 'master_miner',
      name: '광산 전문가',
      emoji: '⛏️',
      description: '모든 광석 채집 전문. 전체 채집량 +20%',
      bonuses: {
        gatherSpeed: 0.15, // +15% 속도
        quantity: 0.2, // 전체 +20%
      },
    },
  },

  herbalist: {
    botanist: {
      key: 'botanist',
      name: '식물학자',
      emoji: '🌱',
      description: '희귀 허브 발견 확률 증가. 마법 허브 채집 가능',
      bonuses: {
        gatherSpeed: 0.1,
        rareHerbChance: 0.25, // 희귀 허브 +25%
      },
    },
    herbologist: {
      key: 'herbologist',
      name: '약초학자',
      emoji: '🧙',
      description: '약재 품질 향상. 모든 허브 수량 +25%',
      bonuses: {
        quality: 0.15, // +15% 품질
        quantity: 0.25,
      },
    },
  },

  lumberjack: {
    carpenter: {
      key: 'carpenter',
      name: '목공예가',
      emoji: '🏗️',
      description: '희귀 목재 가공 전문. 제작 시 목재 효율 +20%',
      bonuses: {
        gatherSpeed: 0.1,
        woodEfficiency: 0.2, // 목재 효율 +20%
      },
    },
    forester: {
      key: 'forester',
      name: '산림 관리인',
      emoji: '🌲',
      description: '마법 목재 채집 가능. 모든 목재 수량 +25%',
      bonuses: {
        gatherSpeed: 0.15,
        quantity: 0.25,
      },
    },
  },

  fisher: {
    marine_expert: {
      key: 'marine_expert',
      name: '해양 전문가',
      emoji: '🐟',
      description: '희귀 물고기 발견 확률 증가. 진주 채집 가능',
      bonuses: {
        gatherSpeed: 0.1,
        rareFishChance: 0.3,
      },
    },
    seafood_specialist: {
      key: 'seafood_specialist',
      name: '해산물 전문가',
      emoji: '🦞',
      description: '해산물 수량 대폭 증가. 모든 수산물 +30%',
      bonuses: {
        gatherSpeed: 0.15,
        quantity: 0.3,
      },
    },
  },

  hunter: {
    tracker: {
      key: 'tracker',
      name: '야생 추적자',
      emoji: '🦌',
      description: '희귀 가죽과 모피 획득 확률 증가',
      bonuses: {
        gatherSpeed: 0.1,
        rareLeatherChance: 0.25,
      },
    },
    trapper: {
      key: 'trapper',
      name: '포획 전문가',
      emoji: '🏹',
      description: '모든 사냥 재료 수량 +25%. 뼈 추가 획득',
      bonuses: {
        gatherSpeed: 0.15,
        quantity: 0.25,
      },
    },
  },

  // 제작 계열
  blacksmith: {
    weaponsmith: {
      key: 'weaponsmith',
      name: '무기 장인',
      emoji: '⚔️',
      description: '무기 제작 특화. 무기 품질 +20%, 제작 속도 +15%',
      bonuses: {
        craftSpeed: 0.15,
        weaponQuality: 0.2,
      },
    },
    armorsmith: {
      key: 'armorsmith',
      name: '방어구 장인',
      emoji: '🛡️',
      description: '방어구 제작 특화. 방어구 품질 +20%, 제작 속도 +15%',
      bonuses: {
        craftSpeed: 0.15,
        armorQuality: 0.2,
      },
    },
  },

  alchemist: {
    potion_master: {
      key: 'potion_master',
      name: '포션 마스터',
      emoji: '💊',
      description: '포션 효과 +25%. 제작 속도 +20%',
      bonuses: {
        craftSpeed: 0.2,
        potionPower: 0.25,
      },
    },
    scroll_crafter: {
      key: 'scroll_crafter',
      name: '주문서 장인',
      emoji: '📜',
      description: '주문서와 버프 아이템 제작 특화',
      bonuses: {
        craftSpeed: 0.15,
        scrollQuality: 0.3,
      },
    },
  },

  tailor: {
    fashion_designer: {
      key: 'fashion_designer',
      name: '의상 디자이너',
      emoji: '👔',
      description: '의류 품질 +25%. 특수 효과 추가 가능',
      bonuses: {
        craftSpeed: 0.15,
        clothQuality: 0.25,
      },
    },
    bag_maker: {
      key: 'bag_maker',
      name: '가방 장인',
      emoji: '🎒',
      description: '가방과 수납 아이템 제작 특화',
      bonuses: {
        craftSpeed: 0.2,
        bagCapacity: 0.3,
      },
    },
  },

  cook: {
    gourmet_chef: {
      key: 'gourmet_chef',
      name: '고급 요리사',
      emoji: '🍖',
      description: '고급 음식 제작. 회복량 +30%',
      bonuses: {
        craftSpeed: 0.15,
        foodPower: 0.3,
      },
    },
    buff_cook: {
      key: 'buff_cook',
      name: '버프 요리사',
      emoji: '🥘',
      description: '버프 음식 제작 특화. 버프 효과 +25%',
      bonuses: {
        craftSpeed: 0.2,
        buffDuration: 0.25,
      },
    },
  },
};

// 생산 직업 전직 레벨
const PRODUCTION_JOB_CHANGE_LEVEL = 5;

function canProductionJobChange(character) {
  if (!character.productionClass) {
    return {
      allowed: false,
      reason: '생산 직업이 없습니다. `/production`으로 먼저 선택하세요.',
    };
  }

  if (character.advancedProductionClass) {
    return {
      allowed: false,
      reason: '이미 전직을 완료했습니다.',
    };
  }

  if (character.productionLevel < PRODUCTION_JOB_CHANGE_LEVEL) {
    return {
      allowed: false,
      reason: `생산 전직은 레벨 ${PRODUCTION_JOB_CHANGE_LEVEL}부터 가능합니다. (현재 Lv.${character.productionLevel})`,
    };
  }

  return {
    allowed: true,
  };
}

function getProductionAdvancedClassChoices(baseClass) {
  const normalized = baseClass.toLowerCase();
  const choices = PRODUCTION_ADVANCED_CLASSES[normalized];

  if (!choices) {
    console.log(`[생산 전직] 인식 불가능한 class: ${baseClass} → ${normalized}`);
    return [];
  }

  return Object.entries(choices).map(([key, data]) => ({
    key,
    name: data.name,
    emoji: data.emoji,
    description: data.description,
    bonuses: data.bonuses,
  }));
}

function getProductionAdvancedClassData(baseClass, advancedClassKey) {
  const normalized = baseClass.toLowerCase();
  const choices = PRODUCTION_ADVANCED_CLASSES[normalized];

  if (!choices || !choices[advancedClassKey]) {
    console.log(
      `[생산 전직 데이터] baseClass: ${baseClass} → ${normalized}, advancedClassKey: ${advancedClassKey}`,
    );
    return null;
  }

  return {
    ...choices[advancedClassKey],
    key: advancedClassKey,
  };
}

function applyProductionJobChange(character, advancedClassKey) {
  const classData = getProductionAdvancedClassData(character.productionClass, advancedClassKey);

  if (!classData) {
    return null;
  }

  return {
    advancedProductionClass: classData.name,
  };
}

module.exports = {
  PRODUCTION_ADVANCED_CLASSES,
  PRODUCTION_JOB_CHANGE_LEVEL,
  canProductionJobChange,
  getProductionAdvancedClassChoices,
  getProductionAdvancedClassData,
  applyProductionJobChange,
};
