// 생산 스킬 시스템

const PRODUCTION_SKILLS = {
  // 대장장이 스킬
  advanced_smithing: {
    key: 'advanced_smithing',
    name: '고급 대장기술',
    emoji: '⚒️',
    class: 'blacksmith',
    requiredLevel: 5,
    cost: 1000,
    description: '희귀(T3) 장비를 제작할 수 있습니다',
    unlocks: ['silver_blade', 'mithril_armor'],
  },
  master_smithing: {
    key: 'master_smithing',
    name: '대장 마스터',
    emoji: '🔨',
    class: 'blacksmith',
    requiredLevel: 10,
    cost: 3000,
    description: '영웅(T4) 장비를 제작할 수 있습니다',
    requires: ['advanced_smithing'],
    unlocks: ['dragon_slayer', 'legendary_plate'],
  },

  // 연금술사 스킬
  advanced_alchemy: {
    key: 'advanced_alchemy',
    name: '고급 연금술',
    emoji: '🧪',
    class: 'alchemist',
    requiredLevel: 5,
    cost: 800,
    description: '강력한 포션과 버프 물약을 만들 수 있습니다',
    unlocks: ['elixir_of_strength', 'elixir_of_defense'],
  },
  master_alchemy: {
    key: 'master_alchemy',
    name: '연금 마스터',
    emoji: '⚗️',
    class: 'alchemist',
    requiredLevel: 10,
    cost: 2500,
    description: '전설적인 영약을 제조할 수 있습니다',
    requires: ['advanced_alchemy'],
    unlocks: ['philosophers_stone', 'immortality_elixir'],
  },

  // 재봉사 스킬
  advanced_tailoring: {
    key: 'advanced_tailoring',
    name: '고급 재봉술',
    emoji: '🪡',
    class: 'tailor',
    requiredLevel: 5,
    cost: 800,
    description: '마법이 깃든 의류를 제작할 수 있습니다',
    unlocks: ['enchanted_robe', 'shadow_cloak'],
  },
  master_tailoring: {
    key: 'master_tailoring',
    name: '재봉 마스터',
    emoji: '🧵',
    class: 'tailor',
    requiredLevel: 10,
    cost: 2500,
    description: '전설적인 의상을 만들 수 있습니다',
    requires: ['advanced_tailoring'],
    unlocks: ['celestial_robe', 'dragon_scale_armor'],
  },

  // 요리사 스킬
  advanced_cooking: {
    key: 'advanced_cooking',
    name: '고급 요리법',
    emoji: '👨‍🍳',
    class: 'chef',
    requiredLevel: 5,
    cost: 600,
    description: '강력한 버프 음식을 만들 수 있습니다',
    unlocks: ['power_steak', 'guardian_soup'],
  },
  master_cooking: {
    key: 'master_cooking',
    name: '요리 마스터',
    emoji: '🍳',
    class: 'chef',
    requiredLevel: 10,
    cost: 2000,
    description: '전설적인 요리를 만들 수 있습니다',
    requires: ['advanced_cooking'],
    unlocks: ['feast_of_kings', 'dragon_meat_stew'],
  },
};

// 직업별 스킬 반환
function getProductionSkillsByClass(productionClass) {
  return Object.values(PRODUCTION_SKILLS).filter((skill) => skill.class === productionClass);
}

// 캐릭터가 스킬을 보유했는지 확인
function hasProductionSkill(character, skillKey) {
  if (!character.skills) return false;
  return character.skills.some((s) => s.skillKey === skillKey);
}

// 레시피를 제작할 수 있는지 확인 (스킬 체크)
function canCraftRecipe(recipe, character) {
  // 스킬 요구사항이 없으면 기본 제작 가능
  if (!recipe.requiredSkill) return true;

  // 스킬이 필요하면 보유 확인
  return hasProductionSkill(character, recipe.requiredSkill);
}

// 스킬 구매 가능 여부 확인
function canLearnProductionSkill(skill, character) {
  // 이미 배웠으면 불가
  if (hasProductionSkill(character, skill.key)) {
    return { allowed: false, reason: '이미 배운 스킬입니다' };
  }

  // 레벨 체크
  if (character.productionLevel < skill.requiredLevel) {
    return {
      allowed: false,
      reason: `생산 레벨 ${skill.requiredLevel} 이상 필요 (현재: ${character.productionLevel})`,
    };
  }

  // 선행 스킬 체크
  if (skill.requires) {
    for (const requiredSkill of skill.requires) {
      if (!hasProductionSkill(character, requiredSkill)) {
        const prereq = PRODUCTION_SKILLS[requiredSkill];
        return {
          allowed: false,
          reason: `선행 스킬 '${prereq.name}' 필요`,
        };
      }
    }
  }

  // 골드 체크
  if (character.gold < skill.cost) {
    return {
      allowed: false,
      reason: `골드 부족 (필요: ${skill.cost}G, 보유: ${character.gold}G)`,
    };
  }

  return { allowed: true };
}

module.exports = {
  PRODUCTION_SKILLS,
  getProductionSkillsByClass,
  hasProductionSkill,
  canCraftRecipe,
  canLearnProductionSkill,
};
