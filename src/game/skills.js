const { randomInt } = require('./monsters');

// 클래스 이름 매핑 (한글 → 영어)
const CLASS_NAME_MAP = {
  '전사': 'warrior',
  '궁수': 'ranger',
  '마법사': 'sorcerer',
  'warrior': 'warrior',
  'ranger': 'ranger',
  'sorcerer': 'sorcerer',
};

// 각 직업별 스킬 3개 (Lv.1, Lv.3, Lv.5)
const SKILLS = {
  warrior: [
    {
      key: 'power_strike',
      name: '강타',
      emoji: '💥',
      description: '강력한 일격을 날립니다',
      manaCost: 10,
      unlockLevel: 1,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 1.5);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          message: `💥 ${character.name}의 강타!`,
        };
      },
    },
    {
      key: 'charge',
      name: '돌진',
      emoji: '⚡',
      description: '적에게 돌진하여 큰 피해를 입힙니다',
      manaCost: 15,
      unlockLevel: 3,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 2.0);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          message: `⚡ ${character.name}의 돌진 공격!`,
        };
      },
    },
    {
      key: 'war_cry',
      name: '전쟁의 함성',
      emoji: '📢',
      description: '아군의 공격력을 증가시킵니다',
      manaCost: 20,
      unlockLevel: 5,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 1.8);
        const damage = Math.max(1, baseDamage - monster.defense);
        const buffAmount = Math.floor(character.attack * 0.2);
        return {
          damage,
          buff: { attack: buffAmount, duration: 3 },
          message: `📢 ${character.name}의 전쟁의 함성! 공격력이 상승합니다!`,
        };
      },
    },
  ],

  ranger: [
    {
      key: 'aimed_shot',
      name: '정조준',
      emoji: '🎯',
      description: '정확한 조준으로 치명타 확률 증가',
      manaCost: 8,
      unlockLevel: 1,
      effect: (character, monster) => {
        const critChance = 0.5; // 50% 크리티컬 확률
        const isCrit = Math.random() < critChance;
        const baseDamage = Math.floor(character.attack * (isCrit ? 2.5 : 1.3));
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          critical: isCrit,
          message: isCrit
            ? `🎯💥 ${character.name}의 완벽한 조준! 치명타!`
            : `🎯 ${character.name}의 정조준 사격!`,
        };
      },
    },
    {
      key: 'multi_shot',
      name: '연속 사격',
      emoji: '🏹',
      description: '빠르게 여러 발을 발사합니다',
      manaCost: 12,
      unlockLevel: 3,
      effect: (character, monster) => {
        const hits = 3;
        const baseDamagePerHit = Math.floor(character.attack * 0.7);
        const damagePerHit = Math.max(1, baseDamagePerHit - Math.floor(monster.defense * 0.7));
        const totalDamage = damagePerHit * hits;
        return {
          damage: totalDamage,
          message: `🏹 ${character.name}의 연속 사격! (${hits}회 명중)`,
        };
      },
    },
    {
      key: 'poison_arrow',
      name: '맹독 화살',
      emoji: '☠️',
      description: '독이 발린 화살로 지속 피해를 입힙니다',
      manaCost: 18,
      unlockLevel: 5,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 1.5);
        const damage = Math.max(1, baseDamage - monster.defense);
        const poisonDamage = Math.floor(character.attack * 0.3);
        return {
          damage,
          poison: { damage: poisonDamage, duration: 3 },
          message: `☠️ ${character.name}의 맹독 화살! 적이 중독되었습니다!`,
        };
      },
    },
  ],

  sorcerer: [
    {
      key: 'fireball',
      name: '파이어볼',
      emoji: '🔥',
      description: '화염구를 발사하여 큰 피해를 입힙니다',
      manaCost: 12,
      unlockLevel: 1,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 1.8);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.5));
        return {
          damage,
          message: `🔥 ${character.name}의 파이어볼!`,
        };
      },
    },
    {
      key: 'ice_lance',
      name: '얼음 창',
      emoji: '❄️',
      description: '얼음 창으로 적을 공격하고 빙결시킵니다',
      manaCost: 15,
      unlockLevel: 3,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 1.6);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.5));
        const freezeChance = 0.4; // 40% 빙결 확률
        const isFrozen = Math.random() < freezeChance;
        return {
          damage,
          freeze: isFrozen,
          message: isFrozen
            ? `❄️ ${character.name}의 얼음 창! 적이 얼어붙었습니다!`
            : `❄️ ${character.name}의 얼음 창!`,
        };
      },
    },
    {
      key: 'meteor',
      name: '메테오',
      emoji: '☄️',
      description: '하늘에서 운석을 떨어뜨립니다',
      manaCost: 25,
      unlockLevel: 5,
      effect: (character, monster) => {
        const baseDamage = Math.floor(character.attack * 3.0);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.3));
        return {
          damage,
          message: `☄️💥 ${character.name}의 메테오! 하늘에서 운석이 떨어집니다!`,
        };
      },
    },
  ],
};

// 캐릭터가 사용 가능한 스킬 목록 반환
function getAvailableSkills(character) {
  const classKey = CLASS_NAME_MAP[character.class] || character.class;
  const classSkills = SKILLS[classKey] || [];
  return classSkills.filter((skill) => character.level >= skill.unlockLevel);
}

// 전투에서 기본으로 사용할 스킬 (가장 높은 레벨의 스킬)
function getCombatSkill(character) {
  const available = getAvailableSkills(character);
  if (available.length === 0) return null;

  // 가장 높은 unlockLevel의 스킬 반환
  return available.reduce((highest, skill) =>
    skill.unlockLevel > highest.unlockLevel ? skill : highest,
  );
}

// 스킬 키로 스킬 찾기
function getSkillByKey(character, skillKey) {
  const classKey = CLASS_NAME_MAP[character.class] || character.class;
  const classSkills = SKILLS[classKey] || [];
  return classSkills.find((skill) => skill.key === skillKey);
}

// 스킬 사용 가능 여부 체크
function canUseSkill(character, skill) {
  if (!skill) return { allowed: false, reason: '스킬이 존재하지 않습니다.' };

  if (character.level < skill.unlockLevel) {
    return {
      allowed: false,
      reason: `이 스킬은 레벨 ${skill.unlockLevel}부터 사용할 수 있습니다.`,
    };
  }

  const currentMana = character.mana ?? 0;
  if (currentMana < skill.manaCost) {
    return {
      allowed: false,
      reason: `마나가 부족합니다. (필요: ${skill.manaCost}, 현재: ${currentMana})`,
    };
  }

  return { allowed: true };
}

module.exports = {
  SKILLS,
  CLASS_NAME_MAP,
  getAvailableSkills,
  getCombatSkill,
  getSkillByKey,
  canUseSkill,
};
