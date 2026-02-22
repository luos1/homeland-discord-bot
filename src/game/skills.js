const CLASS_KEY_MAP = {
  warrior: 'warrior',
  Warrior: 'warrior',
  전사: 'warrior',
  ranger: 'ranger',
  Ranger: 'ranger',
  궁수: 'ranger',
  sorcerer: 'sorcerer',
  Sorcerer: 'sorcerer',
  마법사: 'sorcerer',
};

const CLASS_SKILLS = {
  warrior: [
    {
      id: 'shield_bash',
      name: '실드 배시',
      emoji: '🛡️',
      unlockLevel: 1,
      manaCost: 14,
      damageMultiplier: 1.45,
      critChanceBonus: 0.05,
      critMultiplier: 1.7,
    },
    {
      id: 'power_strike',
      name: '파워 스트라이크',
      emoji: '🔥',
      unlockLevel: 8,
      manaCost: 18,
      damageMultiplier: 1.75,
      critChanceBonus: 0.06,
      critMultiplier: 1.8,
    },
    {
      id: 'whirlwind',
      name: '휘몰아치기',
      emoji: '🌪️',
      unlockLevel: 18,
      manaCost: 24,
      damageMultiplier: 2.1,
      critChanceBonus: 0.08,
      critMultiplier: 1.9,
    },
  ],
  ranger: [
    {
      id: 'precise_shot',
      name: '정밀 사격',
      emoji: '🏹',
      unlockLevel: 1,
      manaCost: 12,
      damageMultiplier: 1.5,
      critChanceBonus: 0.08,
      critMultiplier: 1.75,
    },
    {
      id: 'weakness_shot',
      name: '약점 공격',
      emoji: '🎯',
      unlockLevel: 8,
      manaCost: 16,
      damageMultiplier: 1.8,
      critChanceBonus: 0.1,
      critMultiplier: 1.85,
    },
    {
      id: 'rapid_fire',
      name: '연발 사격',
      emoji: '🔫',
      unlockLevel: 18,
      manaCost: 22,
      damageMultiplier: 2.05,
      critChanceBonus: 0.12,
      critMultiplier: 2.0,
    },
  ],
  sorcerer: [
    {
      id: 'ice_bolt',
      name: '아이스 볼트',
      emoji: '❄️',
      unlockLevel: 1,
      manaCost: 16,
      damageMultiplier: 1.65,
      critChanceBonus: 0.06,
      critMultiplier: 1.8,
    },
    {
      id: 'fireball',
      name: '파이어볼',
      emoji: '🔥',
      unlockLevel: 8,
      manaCost: 20,
      damageMultiplier: 1.95,
      critChanceBonus: 0.08,
      critMultiplier: 1.9,
    },
    {
      id: 'meteor',
      name: '메테오',
      emoji: '💫',
      unlockLevel: 18,
      manaCost: 28,
      damageMultiplier: 2.3,
      critChanceBonus: 0.1,
      critMultiplier: 2.0,
    },
  ],
};

function normalizeClassKey(className) {
  return CLASS_KEY_MAP[className] ?? null;
}

function getClassSkills(className) {
  const classKey = normalizeClassKey(className);

  if (!classKey) {
    return [];
  }

  return CLASS_SKILLS[classKey] ?? [];
}

function getUnlockedClassSkills(className, level = 1) {
  return getClassSkills(className).filter((skill) => level >= skill.unlockLevel);
}

function getCombatSkill(character) {
  const unlocked = getUnlockedClassSkills(character.class, character.level);

  if (unlocked.length === 0) {
    return null;
  }

  // 가장 최근에 해금된 스킬을 전투 버튼에 연결한다.
  return unlocked[unlocked.length - 1];
}

module.exports = {
  CLASS_SKILLS,
  normalizeClassKey,
  getClassSkills,
  getUnlockedClassSkills,
  getCombatSkill,
};
