const LEVEL_CAP = 50;

function xpRequiredForLevel(level) {
  if (level >= LEVEL_CAP) {
    return null;
  }

  // 초반 레벨업 빠르게 조정
  // Lv1→2: 50, Lv2→3: 75, Lv3→4: 100, Lv4→5: 125...
  // Lv10→11: 275, Lv20→21: 525
  return 50 + (level - 1) * 25;
}

function applyExperience(character, gainedXp, currentHp, currentMana = character.mana) {
  const safeGain = Math.max(0, gainedXp);

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

  return {
    characterUpdate: {
      level,
      xp,
      hp,
      maxHp,
      mana,
      maxMana,
      attack,
      defense,
    },
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
