const LEVEL_CAP = 100;

function resolveMasteryFieldByClass(className) {
  const classMapping = {
    warrior: 'warriorMastery',
    ranger: 'rangerMastery',
    mage: 'mageMastery',
    sorcerer: 'mageMastery',
    '전사': 'warriorMastery',
    '궁수': 'rangerMastery',
    '마법사': 'mageMastery',
  };

  const normalized = (className || '').toLowerCase();
  return classMapping[normalized] || null;
}

function xpRequiredForLevel(level) {
  if (level >= LEVEL_CAP) {
    return null;
  }

  // 기본 경험치 공식: 50 + (level - 1) * 25
  let baseXp = 50 + (level - 1) * 25;

  // Lv10-30 구간: 레벨업 속도 1.3배 (필요 경험치를 1/1.3 = 약 0.77배로 감소)
  if (level >= 10 && level <= 30) {
    baseXp = Math.floor(baseXp / 1.3);
  }

  return baseXp;
}

function applyExperience(
  character,
  gainedXp,
  currentHp,
  currentMana = character.mana,
  options = {},
) {
  const safeGain = Math.max(0, gainedXp);
  const isCombatVictory = options.combatVictory === true;

  let level = character.level;
  let xp = character.xp + safeGain;
  let maxHp = character.maxHp;
  let maxMana = character.maxMana ?? 40;
  let attack = character.attack;
  let defense = character.defense;
  let hp = Math.min(currentHp, maxHp);
  let mana = Math.min(currentMana ?? maxMana, maxMana);

  let levelsGained = 0;

  while (level < LEVEL_CAP) {
    const required = xpRequiredForLevel(level);

    if (required === null || xp < required) {
      break;
    }

    xp -= required;
    level += 1;
    levelsGained += 1;

    // 레벨업 보너스: 1주차 기준으로 단순하고 체감되게 유지한다.
    maxHp += 12;
    maxMana += 4;
    attack += 3;
    defense += 2;
    hp = maxHp;
    mana = maxMana;
  }

  if (level >= LEVEL_CAP) {
    xp = 0;
  }

  const characterUpdate = {
    level,
    xp,
    hp,
    maxHp,
    mana,
    maxMana,
    attack,
    defense,
  };

  if (isCombatVictory) {
    const masteryField = resolveMasteryFieldByClass(character.class);
    if (masteryField) {
      characterUpdate[masteryField] = (character[masteryField] || 0) + 1;
    }
  }

  return {
    characterUpdate,
    levelsGained,
    reachedCap: level >= LEVEL_CAP,
  };
}

function progressToNextLevel(character) {
  const required = xpRequiredForLevel(character.level);

  if (required === null) {
    return {
      required: null,
      remaining: 0,
      ratio: 1,
    };
  }

  const remaining = Math.max(required - character.xp, 0);
  const ratio = Math.min(character.xp / required, 1);

  return {
    required,
    remaining,
    ratio,
  };
}

module.exports = {
  LEVEL_CAP,
  xpRequiredForLevel,
  applyExperience,
  progressToNextLevel,
};
