// 전직 후 사용 가능한 고급 스킬
// 각 전직 직업별로 7개 스킬 (5개 상점 구매, 2개 보스 드랍)

const ADVANCED_SKILLS = {
  berserker: [
    // 상점 판매 스킬 (5개)
    {
      key: 'blood_rage',
      name: '피의 분노',
      emoji: '🩸',
      description: 'HP를 소모하여 강력한 공격을 가합니다',
      manaCost: 15,
      shopPrice: 500,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.5 * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          selfDamage: Math.floor(character.maxHp * 0.1),
          message: `🩸 ${character.name}의 피의 분노! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'whirlwind',
      name: '회오리 베기',
      emoji: '🌪️',
      description: '주변의 모든 적을 공격합니다',
      manaCost: 20,
      shopPrice: 800,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.0 * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          message: `🌪️ ${character.name}의 회오리 베기! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'iron_will',
      name: '강철 의지',
      emoji: '💪',
      description: '일정 시간 받는 피해 감소',
      manaCost: 25,
      shopPrice: 1200,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 1.5 * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          buff: { defenseMultiplier: 1.5, duration: 3 },
          message: `💪 ${character.name}의 강철 의지! 방어력 증가! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'execution',
      name: '처형',
      emoji: '⚔️',
      description: 'HP가 낮은 적에게 치명적인 피해',
      manaCost: 30,
      shopPrice: 1500,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const hpPercent = monster.hp / monster.maxHp;
        const executionBonus = hpPercent < 0.3 ? 2.0 : 1.0;
        const baseDamage = Math.floor(character.attack * 2.2 * executionBonus * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          message:
            executionBonus > 1
              ? `⚔️💀 ${character.name}의 처형! 치명타! (Lv.${skillLevel})`
              : `⚔️ ${character.name}의 처형! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'battle_shout',
      name: '전투의 함성',
      emoji: '📣',
      description: '공격력과 방어력을 동시에 증가시킵니다',
      manaCost: 35,
      shopPrice: 2000,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 1.8 * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          buff: { attack: Math.floor(character.attack * 0.3), defense: Math.floor(character.defense * 0.3), duration: 4 },
          message: `📣 ${character.name}의 전투의 함성! 전투력 상승! (Lv.${skillLevel})`,
        };
      },
    },
    // 보스 드랍 스킬 (2개)
    {
      key: 'berserk_rage',
      name: '광전사의 분노',
      emoji: '💢',
      description: '[보스 전용] 체력이 낮을수록 공격력 증가',
      manaCost: 40,
      type: 'boss_drop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.3;
        const hpPercent = character.hp / character.maxHp;
        const rageBonus = 1 + (1 - hpPercent) * 1.5;
        const baseDamage = Math.floor(character.attack * 3.0 * rageBonus * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          message: `💢💥 ${character.name}의 광전사의 분노! 압도적인 힘! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'titans_grip',
      name: '타이탄의 장악',
      emoji: '🔨',
      description: '[보스 전용] 엄청난 공격력으로 적을 분쇄합니다',
      manaCost: 50,
      type: 'boss_drop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.3;
        const baseDamage = Math.floor(character.attack * 4.0 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.5));
        return {
          damage,
          message: `🔨💥💥 ${character.name}의 타이탄의 장악! 압도적인 파괴력! (Lv.${skillLevel})`,
        };
      },
    },
  ],

  sniper: [
    // 상점 판매 스킬 (5개)
    {
      key: 'headshot',
      name: '헤드샷',
      emoji: '🎯',
      description: '높은 확률로 치명타를 가합니다',
      manaCost: 12,
      shopPrice: 500,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const critChance = 0.7 + (skillLevel - 1) * 0.05;
        const isCrit = Math.random() < critChance;
        const baseDamage = Math.floor(character.attack * (isCrit ? 3.0 : 1.5) * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          critical: isCrit,
          message: isCrit
            ? `🎯💀 ${character.name}의 완벽한 헤드샷! (Lv.${skillLevel})`
            : `🎯 ${character.name}의 헤드샷! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'rapid_fire',
      name: '속사',
      emoji: '💨',
      description: '빠르게 여러 발을 발사합니다',
      manaCost: 18,
      shopPrice: 800,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const hits = 4 + skillLevel - 1;
        const baseDamagePerHit = Math.floor(character.attack * 0.6 * levelMultiplier);
        const damagePerHit = Math.max(1, baseDamagePerHit - Math.floor(monster.defense * 0.6));
        const totalDamage = damagePerHit * hits;
        return {
          damage: totalDamage,
          message: `💨 ${character.name}의 속사! (${hits}회 명중) (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'explosive_arrow',
      name: '폭발 화살',
      emoji: '💣',
      description: '폭발하는 화살로 큰 피해를 입힙니다',
      manaCost: 22,
      shopPrice: 1200,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.3 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.7));
        return {
          damage,
          message: `💣💥 ${character.name}의 폭발 화살! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'camouflage',
      name: '위장',
      emoji: '👻',
      description: '은신하여 다음 공격의 피해를 크게 증가시킵니다',
      manaCost: 25,
      shopPrice: 1500,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.5 * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        return {
          damage,
          buff: { nextAttackBonus: 1.5, duration: 1 },
          message: `👻 ${character.name}의 위장! 다음 공격 강화! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'volley',
      name: '일제 사격',
      emoji: '🏹',
      description: '하늘에서 화살비를 쏟아냅니다',
      manaCost: 30,
      shopPrice: 2000,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.8 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.6));
        return {
          damage,
          message: `🏹💥 ${character.name}의 일제 사격! 화살비! (Lv.${skillLevel})`,
        };
      },
    },
    // 보스 드랍 스킬 (2개)
    {
      key: 'piercing_shot',
      name: '관통 사격',
      emoji: '🔫',
      description: '[보스 전용] 방어력을 무시하고 관통합니다',
      manaCost: 35,
      type: 'boss_drop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.3;
        const baseDamage = Math.floor(character.attack * 3.5 * levelMultiplier);
        const damage = Math.max(1, baseDamage); // 방어력 무시
        return {
          damage,
          message: `🔫💥 ${character.name}의 관통 사격! 방어 무시! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'death_mark',
      name: '죽음의 표식',
      emoji: '☠️',
      description: '[보스 전용] 적에게 표식을 남겨 추가 피해를 입힙니다',
      manaCost: 45,
      type: 'boss_drop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.3;
        const baseDamage = Math.floor(character.attack * 4.0 * levelMultiplier);
        const damage = Math.max(1, baseDamage - monster.defense);
        const markDamage = Math.floor(character.attack * 0.5);
        return {
          damage,
          debuff: { mark: markDamage, duration: 3 },
          message: `☠️💀 ${character.name}의 죽음의 표식! 저주 발동! (Lv.${skillLevel})`,
        };
      },
    },
  ],

  archmage: [
    // 상점 판매 스킬 (5개)
    {
      key: 'chain_lightning',
      name: '연쇄 번개',
      emoji: '⚡',
      description: '번개가 여러 대상에게 연쇄됩니다',
      manaCost: 20,
      shopPrice: 500,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.0 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.4));
        return {
          damage,
          message: `⚡ ${character.name}의 연쇄 번개! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'flame_pillar',
      name: '화염 기둥',
      emoji: '🔥',
      description: '거대한 화염 기둥을 소환합니다',
      manaCost: 25,
      shopPrice: 800,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.5 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.3));
        const burnDamage = Math.floor(character.attack * 0.4);
        return {
          damage,
          burn: { damage: burnDamage, duration: 3 },
          message: `🔥 ${character.name}의 화염 기둥! 지속 화상! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'blizzard',
      name: '블리자드',
      emoji: '🌨️',
      description: '눈보라로 광역 피해를 입힙니다',
      manaCost: 30,
      shopPrice: 1200,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.2 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.4));
        const slowChance = 0.6;
        const isSlow = Math.random() < slowChance;
        return {
          damage,
          slow: isSlow,
          message: isSlow
            ? `🌨️❄️ ${character.name}의 블리자드! 적이 얼어붙습니다! (Lv.${skillLevel})`
            : `🌨️ ${character.name}의 블리자드! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'mana_burst',
      name: '마나 폭발',
      emoji: '💫',
      description: '마나를 폭발시켜 강력한 피해를 입힙니다',
      manaCost: 35,
      shopPrice: 1500,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const manaPercent = (character.mana ?? 0) / (character.maxMana ?? 1);
        const manaBonus = 1 + manaPercent;
        const baseDamage = Math.floor(character.attack * 2.5 * manaBonus * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.3));
        return {
          damage,
          message: `💫💥 ${character.name}의 마나 폭발! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'time_warp',
      name: '시간 왜곡',
      emoji: '⏰',
      description: '시간을 조작하여 추가 행동을 얻습니다',
      manaCost: 40,
      shopPrice: 2000,
      type: 'shop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.2;
        const baseDamage = Math.floor(character.attack * 2.0 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.4));
        return {
          damage,
          buff: { extraTurn: true, duration: 1 },
          message: `⏰ ${character.name}의 시간 왜곡! 시간 조작! (Lv.${skillLevel})`,
        };
      },
    },
    // 보스 드랍 스킬 (2개)
    {
      key: 'black_hole',
      name: '블랙홀',
      emoji: '🌑',
      description: '[보스 전용] 블랙홀로 모든 것을 빨아들입니다',
      manaCost: 50,
      type: 'boss_drop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.3;
        const baseDamage = Math.floor(character.attack * 4.5 * levelMultiplier);
        const damage = Math.max(1, baseDamage - Math.floor(monster.defense * 0.2));
        return {
          damage,
          message: `🌑💀 ${character.name}의 블랙홀! 압도적인 중력! (Lv.${skillLevel})`,
        };
      },
    },
    {
      key: 'apocalypse',
      name: '아포칼립스',
      emoji: '💥',
      description: '[보스 전용] 세계를 멸망시킬 마법을 발동합니다',
      manaCost: 60,
      type: 'boss_drop',
      effect: (character, monster, skillLevel = 1) => {
        const levelMultiplier = 1 + (skillLevel - 1) * 0.3;
        const baseDamage = Math.floor(character.attack * 5.0 * levelMultiplier);
        const damage = Math.max(1, baseDamage);
        return {
          damage,
          message: `💥🔥⚡☄️ ${character.name}의 아포칼립스! 세계 멸망! (Lv.${skillLevel})`,
        };
      },
    },
  ],
};

// 한글 전직명 → ADVANCED_SKILLS 키 매핑
const ADVANCED_CLASS_MAPPING = {
  '검성': 'berserker',
  '수호자': 'berserker',
  '저격수': 'sniper',
  '사냥꾼': 'sniper',
  '대마법사': 'archmage',
  '마도학자': 'archmage',
};

// 특정 전직 직업의 스킬 목록 반환
function getAdvancedSkillList(advancedClass) {
  const mapped = ADVANCED_CLASS_MAPPING[advancedClass] || advancedClass;
  return ADVANCED_SKILLS[mapped] || [];
}

// 상점에서 판매 가능한 스킬만 반환
function getShopSkills(advancedClass) {
  const skills = getAdvancedSkillList(advancedClass);
  return skills.filter((skill) => skill.type === 'shop');
}

// 보스 드랍 스킬만 반환
function getBossDropSkills(advancedClass) {
  const skills = getAdvancedSkillList(advancedClass);
  return skills.filter((skill) => skill.type === 'boss_drop');
}

// 스킬 키로 스킬 찾기
function getAdvancedSkillByKey(advancedClass, skillKey) {
  const skills = getAdvancedSkillList(advancedClass);
  return skills.find((skill) => skill.key === skillKey);
}

// boss-combat.js에서 사용하는 alias
const getAdvancedClassSkills = getAdvancedSkillList;

module.exports = {
  ADVANCED_SKILLS,
  getAdvancedSkillList,
  getAdvancedClassSkills,
  getShopSkills,
  getBossDropSkills,
  getAdvancedSkillByKey,
};
