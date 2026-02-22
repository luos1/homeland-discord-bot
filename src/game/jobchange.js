// 전직 시스템
const JOB_CHANGE_LEVEL = 10;

const ADVANCED_CLASSES = {
  // 전사 전직
  warrior: {
    bladeMaster: {
      name: '검성',
      emoji: '⚔️',
      description: '검술의 극치를 추구하는 전사. 압도적인 공격력을 자랑합니다.',
      bonuses: {
        attack: 8,
        defense: 2,
        maxHp: 30,
        maxMana: 10,
      },
      skills: ['🌪️ 광풍검무', '⚡ 번개베기'],
    },
    guardian: {
      name: '수호자',
      emoji: '🛡️',
      description: '동료를 지키는 불굴의 수호자. 높은 방어력과 생존력을 가집니다.',
      bonuses: {
        attack: 3,
        defense: 10,
        maxHp: 80,
        maxMana: 5,
      },
      skills: ['🛡️ 철벽방어', '💪 불굴의 의지'],
    },
  },

  // 궁수 전직
  ranger: {
    sniper: {
      name: '저격수',
      emoji: '🎯',
      description: '정확무비한 명사수. 치명타 확률과 피해가 극대화됩니다.',
      bonuses: {
        attack: 10,
        defense: 3,
        maxHp: 40,
        maxMana: 15,
      },
      skills: ['🎯 헤드샷', '💨 바람의 화살'],
    },
    hunter: {
      name: '사냥꾼',
      emoji: '🏹',
      description: '야생의 본능으로 싸우는 사냥꾼. 빠른 공격과 생존 능력이 뛰어납니다.',
      bonuses: {
        attack: 6,
        defense: 5,
        maxHp: 50,
        maxMana: 20,
      },
      skills: ['🏹 연속 사격', '🦅 독수리의 눈'],
    },
  },

  // 마법사 전직
  sorcerer: {
    archmage: {
      name: '대마법사',
      emoji: '🔮',
      description: '마법의 정점에 선 대마법사. 강력한 마법 공격력과 마나를 가집니다.',
      bonuses: {
        attack: 12,
        defense: 1,
        maxHp: 20,
        maxMana: 60,
      },
      skills: ['🔮 메테오', '⚡ 체인 라이트닝'],
    },
    battlemage: {
      name: '마도학자',
      emoji: '✨',
      description: '마법과 전투를 결합한 마도학자. 균형잡힌 능력치를 가집니다.',
      bonuses: {
        attack: 8,
        defense: 6,
        maxHp: 40,
        maxMana: 40,
      },
      skills: ['✨ 마법검', '💫 마력 방어막'],
    },
  },
};

function getAdvancedClassChoices(baseClass) {
  const normalized = baseClass.toLowerCase();
  const choices = ADVANCED_CLASSES[normalized];

  if (!choices) {
    return [];
  }

  return Object.entries(choices).map(([key, data]) => ({
    key,
    name: data.name,
    emoji: data.emoji,
    description: data.description,
    bonuses: data.bonuses,
    skills: data.skills,
  }));
}

function getAdvancedClassData(baseClass, advancedClassKey) {
  const normalized = baseClass.toLowerCase();
  const choices = ADVANCED_CLASSES[normalized];

  if (!choices || !choices[advancedClassKey]) {
    return null;
  }

  return {
    ...choices[advancedClassKey],
    key: advancedClassKey,
  };
}

function canJobChange(character) {
  if (character.advancedClass) {
    return {
      allowed: false,
      reason: '이미 전직한 캐릭터입니다.',
    };
  }

  if (character.level < JOB_CHANGE_LEVEL) {
    return {
      allowed: false,
      reason: `전직은 레벨 ${JOB_CHANGE_LEVEL}부터 가능합니다. (현재 Lv.${character.level})`,
    };
  }

  return {
    allowed: true,
  };
}

function applyJobChange(character, advancedClassKey) {
  const classData = getAdvancedClassData(character.class, advancedClassKey);

  if (!classData) {
    return null;
  }

  const bonuses = classData.bonuses;

  return {
    advancedClass: classData.name,
    maxHp: character.maxHp + bonuses.maxHp,
    hp: character.hp + bonuses.maxHp, // 전직 시 체력 보너스만큼 회복
    maxMana: character.maxMana + bonuses.maxMana,
    mana: character.mana + bonuses.maxMana, // 전직 시 마나 보너스만큼 회복
    attack: character.attack + bonuses.attack,
    defense: character.defense + bonuses.defense,
  };
}

module.exports = {
  JOB_CHANGE_LEVEL,
  ADVANCED_CLASSES,
  getAdvancedClassChoices,
  getAdvancedClassData,
  canJobChange,
  applyJobChange,
};
