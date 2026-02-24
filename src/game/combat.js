const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { applyExperience, progressToNextLevel } = require('./leveling');
const { MONSTERS, RARE_TYPES, getZone, getZoneWithTypeData, randomInt } = require('./monsters');
const { getCombatSkill, getAvailableSkills, getSkillByKey, canUseSkill } = require('./skills');
const { shouldDropEquipment, generateEquipment } = require('./equipment');
const { calculateStreakBonus, updateWinStreak, resetWinStreak } = require('./streak');
const { getAdvancedSkillByKey } = require('./advanced-skills');
const { DAILY_QUEST_EVENTS, recordDailyQuestProgress } = require('./daily-quests');
const { resolvePremiumBenefits } = require('./premium');
const { calculateCombatGoldReward, applyCombatEconomyAdjustments } = require('./economy');
const { recordSkillUse, checkCombo, clearCombo, calculateComboDamage, getComboVisual } = require('./skill-combo');
const { createLevelUpMessage, createMultiLevelUpMessage } = require('./levelup-effects');
const {
  handleOnboardingEvent,
  sendOnboardingFeedback,
} = require('./onboarding');
const {
  EMBED_COLORS,
  createDivider,
  createHPBar,
  createXPBar,
  localizeClassName,
} = require('../utils/ui');

const COMBAT_PREFIX = 'combat';
const COMBAT_END_PREFIX = 'combat_end';

const COMBAT_ACTIONS = {
  attack: 'attack',
  defend: 'defend',
  potion: 'potion',
  potionBase: 'potion_base',
  potionDb: 'potion_db',
  potionCancel: 'potion_cancel',
  skill: 'skill',
  flee: 'flee',
  reset: 'reset',
  auto: 'auto',
};
const COMBAT_ACTION_VALUE_SET = new Set(Object.values(COMBAT_ACTIONS));

const COMBAT_END_ACTIONS = {
  retry: 'retry',
  zones: 'zones',
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARE_MONSTER_PREFIXES = Array.from(
  new Set(
    Object.values(RARE_TYPES).flatMap((rareType) => {
      const prefixes = [rareType.prefix, ...(rareType.legacyPrefixes || [])];
      return prefixes.map((prefix) => `${prefix} `);
    }),
  ),
);
const COMBAT_POTION_EFFECTS = new Set(['heal_hp', 'heal_mp']);
const GLOBAL_CRITICAL_CHANCE = 0.2;
const GLOBAL_CRITICAL_MULTIPLIER = 2;
const GLOBAL_EVASION_CHANCE = 0.15;
const CRITICAL_LOG_MESSAGE = '💥 크리티컬!';
const DODGE_LOG_MESSAGE = '💨 회피!';
const COMBAT_RANDOM_EVENT_CHANCE = 0.2;
const COMBAT_RANDOM_EVENT_TYPES = ['treasure', 'merchant', 'trap'];

function buildCombatCustomId(action, sessionId, skillKey = null) {
  if (skillKey) {
    return `${COMBAT_PREFIX}:${action}:${sessionId}:${skillKey}`;
  }
  return `${COMBAT_PREFIX}:${action}:${sessionId}`;
}

function parseCombatCustomId(customId) {
  if (!customId || !customId.startsWith(`${COMBAT_PREFIX}:`)) {
    return null;
  }

  const parts = customId.split(':');

  if (parts.length < 3) {
    return null;
  }

  const [, action, sessionId, skillKey] = parts;

  if (!COMBAT_ACTION_VALUE_SET.has(action) || !sessionId) {
    return null;
  }

  return {
    action,
    sessionId,
    skillKey: skillKey || null,
  };
}

function isCombatButton(customId) {
  return customId.startsWith(`${COMBAT_PREFIX}:`);
}

function buildCombatEndCustomId(action, zoneKey = 'zone1') {
  return `${COMBAT_END_PREFIX}:${action}:${zoneKey}`;
}

function parseCombatEndCustomId(customId) {
  if (!customId || !customId.startsWith(`${COMBAT_END_PREFIX}:`)) {
    return null;
  }

  const parts = customId.split(':');

  if (parts.length !== 3) {
    return null;
  }

  const [, action, zoneKey] = parts;

  if (!COMBAT_END_ACTIONS[action] || !zoneKey) {
    return null;
  }

  return {
    action,
    zoneKey,
  };
}

function isCombatEndButton(customId) {
  return customId.startsWith(`${COMBAT_END_PREFIX}:`);
}

function stripRareMonsterPrefix(monsterName = '') {
  return RARE_MONSTER_PREFIXES.reduce((name, prefix) => {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
    return name;
  }, monsterName);
}

function resolveRareMonsterType(monsterName = '') {
  if (!monsterName) {
    return null;
  }

  return (
    Object.entries(RARE_TYPES).find(([, rareData]) => {
      const prefixes = [rareData.prefix, ...(rareData.legacyPrefixes || [])];
      return prefixes.some((prefix) => monsterName.startsWith(`${prefix} `));
    })?.[0] ?? null
  );
}

function getMonsterBySessionName(monsterName) {
  if (!monsterName) {
    return null;
  }

  const exactMatch = Object.values(MONSTERS).find((monster) => monster.name === monsterName);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedName = stripRareMonsterPrefix(monsterName);
  const normalizedMatch = Object.values(MONSTERS).find((monster) => monster.name === normalizedName);
  if (normalizedMatch) {
    return normalizedMatch;
  }

  return Object.values(MONSTERS).find((monster) => monsterName.endsWith(monster.name)) ?? null;
}

function resolveRarityPool(minRarity = 'rare') {
  const minIndex = RARITY_ORDER.indexOf(minRarity);
  if (minIndex === -1) {
    return ['rare', 'epic', 'legendary'];
  }
  return RARITY_ORDER.slice(minIndex);
}

function rollFromWeightedPool(pool) {
  if (!pool || pool.length === 0) {
    return 'rare';
  }

  if (pool.length === 1) {
    return pool[0];
  }

  const weightBySize = {
    2: [0.8, 0.2],
    3: [0.7, 0.23, 0.07],
    4: [0.63, 0.22, 0.1, 0.05],
    5: [0.57, 0.22, 0.12, 0.06, 0.03],
  };
  const weights = weightBySize[pool.length] || Array(pool.length).fill(1 / pool.length);
  const roll = Math.random();
  let cumulative = 0;

  for (let index = 0; index < pool.length; index += 1) {
    cumulative += weights[index];
    if (roll <= cumulative) {
      return pool[index];
    }
  }

  return pool[pool.length - 1];
}

function resolveGuaranteedBossRarity(guaranteedDrop) {
  if (!guaranteedDrop) {
    return null;
  }

  if (guaranteedDrop.minRarity) {
    return rollFromWeightedPool(resolveRarityPool(guaranteedDrop.minRarity));
  }

  const rarityLabel = guaranteedDrop.rarity;
  if (!rarityLabel) {
    return null;
  }

  if (rarityLabel.endsWith('+')) {
    return rollFromWeightedPool(resolveRarityPool(rarityLabel.slice(0, -1)));
  }

  return rarityLabel;
}

function resolveTurnInterval(pattern) {
  if (pattern.trigger === 'every_n_turns' && Number.isFinite(pattern.value)) {
    return Math.max(1, Math.floor(pattern.value));
  }

  const match = pattern.trigger.match(/^every_(\d+)_turns$/);
  if (!match) {
    return null;
  }

  return Math.max(1, Number.parseInt(match[1], 10));
}

function shouldTriggerBossPattern(pattern, context) {
  const monsterHpPercent = (context.currentMonsterHp / Math.max(context.monsterMaxHp, 1)) * 100;
  const playerHpPercent = (context.playerHp / Math.max(context.playerMaxHp, 1)) * 100;

  if (pattern.trigger === 'hp_below') {
    return monsterHpPercent <= pattern.value;
  }

  if (pattern.trigger === 'player_hp_below') {
    return playerHpPercent <= pattern.value;
  }

  if (pattern.trigger === 'cross_hp_below') {
    const thresholdHp = Math.floor(context.monsterMaxHp * (pattern.value / 100));
    return context.previousMonsterHp > thresholdHp && context.currentMonsterHp <= thresholdHp;
  }

  const interval = resolveTurnInterval(pattern);
  return interval ? context.turn % interval === 0 : false;
}

function applyFieldBossSkillPatterns({
  monsterData,
  session,
  character,
  currentMonsterHp,
  baseDamage,
}) {
  if (!monsterData?.isBoss || !monsterData.skillPatterns || monsterData.skillPatterns.length === 0) {
    return {
      monsterHp: currentMonsterHp,
      enemyDamage: baseDamage,
      logs: [],
    };
  }

  const result = {
    monsterHp: currentMonsterHp,
    damageMultiplier: 1,
    bonusDamage: 0,
    logs: [],
  };
  const context = {
    previousMonsterHp: session.monsterHp,
    currentMonsterHp,
    monsterMaxHp: session.monsterMaxHp,
    playerHp: session.playerHp,
    playerMaxHp: character.maxHp,
    turn: session.turn,
  };

  monsterData.skillPatterns.forEach((pattern) => {
    if (!shouldTriggerBossPattern(pattern, context)) {
      return;
    }

    if (pattern.effect === 'heal') {
      const healAmount = Math.max(0, Math.floor(pattern.amount || 0));
      if (healAmount > 0 && result.monsterHp < session.monsterMaxHp) {
        const healed = Math.min(healAmount, session.monsterMaxHp - result.monsterHp);
        result.monsterHp += healed;
        result.logs.push(`💀 ${pattern.name} 발동! ${monsterData.name}이(가) ${healed} HP 회복했습니다.`);
      }
      return;
    }

    if (pattern.effect === 'attack_multiplier') {
      const multiplier = Math.max(1, Number(pattern.amount) || 1);
      result.damageMultiplier *= multiplier;
      result.logs.push(`💀 ${pattern.name} 발동! 공격력이 ${(multiplier * 100 - 100).toFixed(0)}% 증가합니다.`);
      return;
    }

    if (pattern.effect === 'flat_damage') {
      const extraDamage = Math.max(0, Math.floor(pattern.amount || 0));
      if (extraDamage > 0) {
        result.bonusDamage += extraDamage;
        result.logs.push(`💀 ${pattern.name} 발동! 추가 피해 +${extraDamage}.`);
      }
    }
  });

  return {
    monsterHp: result.monsterHp,
    enemyDamage: baseDamage <= 0
      ? 0
      : Math.max(1, Math.floor(baseDamage * result.damageMultiplier) + result.bonusDamage),
    logs: result.logs,
  };
}

function createCombatActionRows(sessionId, options = {}) {
  const disabled = options.disabled ?? false;
  const character = options.character ?? null;
  const currentMana = character?.mana ?? 0;
  const showPotionOptions = options.showPotionOptions ?? false;
  const sessionPotionsRemaining = options.sessionPotionsRemaining ?? 0;
  const consumablePotions = normalizeCombatConsumablePotions(options.consumablePotions ?? []);

  // 프리미엄 혜택 확인
  const premiumBenefits = character?.premiumSubscription 
    ? resolvePremiumBenefits(character.premiumSubscription)
    : { autoFight: false };
  const hasPremium = premiumBenefits.autoFight;

  // 첫 번째 줄: 기본 액션 버튼 배열
  const mainButtons = [
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.attack, sessionId))
      .setLabel('공격')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.defend, sessionId))
      .setLabel('방어')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  ];

  // 프리미엄 전용: 오토 버튼
  if (hasPremium) {
    mainButtons.push(
      new ButtonBuilder()
        .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.auto, sessionId))
        .setLabel('오토')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
    );
  }

  mainButtons.push(
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.potion, sessionId))
      .setLabel('포션')
      .setEmoji('💊')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.flee, sessionId))
      .setLabel('도망')
      .setEmoji('🏃')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );

  const mainRow = new ActionRowBuilder().addComponents(...mainButtons);

  const rows = [mainRow];

  // 두 번째 줄: 스킬 (기본 스킬 + 전직 스킬)
  if (character) {
    // 기본 스킬
    const basicSkills = getAvailableSkills(character);
    
    // 전직 스킬 (장착된 스킬만 표시 - 최대 3개)
    const advancedSkills = (character.skills || [])
      .filter(s => s.equipped)  // 장착된 스킬만!
      .map(s => {
        const skillData = character.advancedClass 
          ? getAdvancedSkillByKey(character.advancedClass, s.skillKey)
          : null;
        if (!skillData) return null;
        return {
          ...skillData,
          key: s.skillKey,
          dbSkillLevel: s.skillLevel,
        };
      })
      .filter(Boolean);

    // 합치기 (기본 스킬 + 장착된 고급 스킬, 최대 5개)
    const allSkills = [...basicSkills, ...advancedSkills].slice(0, 5);

    if (allSkills.length > 0) {
      const skillButtons = allSkills.map((skill) => {
        const canUse = currentMana >= skill.manaCost;
        const skillLevel = skill.dbSkillLevel || skill.skillLevel || 1;
        const label = skillLevel > 1
          ? `${skill.name} +${skillLevel} (${skill.manaCost} MP)`
          : `${skill.name} (${skill.manaCost} MP)`;
        
        return new ButtonBuilder()
          .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.skill, sessionId, skill.key))
          .setLabel(label)
          .setEmoji(skill.emoji)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled || !canUse);
      });

      const skillRow = new ActionRowBuilder().addComponents(skillButtons);
      rows.push(skillRow);
    }
  }

  if (showPotionOptions) {
    // 디스코드 컴포넌트 제한(최대 5줄)을 넘지 않도록 포션 버튼 줄 수를 제한한다.
    const maxPotionRows = Math.max(0, 4 - rows.length);
    if (maxPotionRows > 0) {
      const maxButtons = maxPotionRows * 5;
      const maxConsumableButtons = Math.max(0, maxButtons - 2);
      const visibleConsumables = consumablePotions.slice(0, maxConsumableButtons);
      const potionButtons = [
        new ButtonBuilder()
          .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.potionBase, sessionId))
          .setLabel(`기본 포션 (${sessionPotionsRemaining})`)
          .setEmoji('💊')
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled || sessionPotionsRemaining <= 0),
        ...visibleConsumables.map((item) =>
          new ButtonBuilder()
            .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.potionDb, sessionId, String(item.id)))
            .setLabel(limitButtonLabel(`${item.name} x${item.quantity}`))
            .setEmoji('🧪')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || item.quantity <= 0),
        ),
        new ButtonBuilder()
          .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.potionCancel, sessionId))
          .setLabel('포션 선택 닫기')
          .setEmoji('↩️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
      ];

      for (let index = 0; index < potionButtons.length; index += 5) {
        const chunk = potionButtons.slice(index, index + 5);
        rows.push(new ActionRowBuilder().addComponents(chunk));
      }
    }
  }

  // 마지막 줄: 리셋 버튼
  const resetRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.reset, sessionId))
      .setLabel('전투 리셋 (HP/MP 회복)')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
  rows.push(resetRow);

  return rows;
}

function limitButtonLabel(label, maxLength = 40) {
  if (!label || label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 3)}...`;
}

function normalizeCombatConsumablePotions(consumables = []) {
  return consumables
    .filter(Boolean)
    .filter((item) => {
      const quantity = Number(item.quantity) || 0;
      const type = String(item.type || '').toLowerCase();
      const effect = String(item.effect || '').toLowerCase();

      if (quantity <= 0) {
        return false;
      }

      return type.includes('potion') || COMBAT_POTION_EFFECTS.has(effect);
    })
    .sort((a, b) => a.id - b.id);
}

function createCombatEndActionRow(zoneKey, options = {}) {
  const disabled = options.disabled ?? false;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCombatEndCustomId(COMBAT_END_ACTIONS.retry, zoneKey))
      .setLabel('다시 전투')
      .setEmoji('🔁')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(buildCombatEndCustomId(COMBAT_END_ACTIONS.zones, zoneKey))
      .setLabel('탐험지 선택')
      .setEmoji('🗺️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function resolveMonsterLevel(monsterName, fallbackLevel = 1) {
  const matched = getMonsterBySessionName(monsterName);
  return matched?.level ?? fallbackLevel;
}

function buildRareMonsterEncounterShowcase(session, monsterLevel) {
  const rareType = resolveRareMonsterType(session.monsterName);
  if (!rareType) {
    return null;
  }

  const baseMonsterName = stripRareMonsterPrefix(session.monsterName);

  if (rareType === 'shiny') {
    return [
      '✨✨✨ 특별한 적 등장! ✨✨✨',
      '',
      '━━━━━━━━━━━━━━━━━━',
      `  🌟 샤이니 ${baseMonsterName} 🌟`,
      '━━━━━━━━━━━━━━━━━━',
      '',
      '💎 이 적은 특별합니다!',
      '   - HP 2배',
      '   - 공격력 1.5배',
      '   - 경험치 5배',
      '   - 골드 10배',
      '   - 전설 장비 드롭 확률 50%',
      '',
      '⚠️ 강력하지만 보상도 엄청납니다!',
      '',
      '[⚔️ 싸운다] [🏃 도망친다]',
    ];
  }

  if (rareType === 'boss') {
    return [
      '💀 보스 등장!',
      '',
      '━━━━━━━━━━━━━━━━━━',
      `  👑 ${baseMonsterName} 👑`,
      `  Lv. ${monsterLevel} (보스)`,
      '━━━━━━━━━━━━━━━━━━',
      '',
      `❤️ HP: ${session.monsterHp}/${session.monsterMaxHp}`,
      `⚔️ 공격력: ${session.monsterAttack}`,
      `🛡️ 방어력: ${session.monsterDefense}`,
      '',
      '🎁 처치 보상:',
      `   - 경험치 +${session.monsterXpReward}`,
      `   - 골드 +${session.monsterGoldMin}~${session.monsterGoldMax}G`,
      '   - 희귀 장비 확정 드롭',
      '   - 특별 칭호 획득',
      '',
      '⚠️ 매우 강력합니다! 준비가 되셨나요?',
      '',
      '[⚔️ 도전] [🏃 도망] [💊 포션 먹고 도전]',
    ];
  }

  return null;
}

function buildFiveWinStreakBonusShowcase() {
  return [
    '🔥 연승 중! 🔥',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '🏆 5연승 달성!',
    '',
    '🎁 보너스:',
    '   - 경험치 +25%',
    '   - 골드 +50%',
    '   - 다음 전투 공격력 +10%',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '💪 기세를 이어가세요!',
    '',
    '[⚔️ 계속 전투] [🏠 마을로]',
  ];
}

function buildTenWinStreakBonusShowcase() {
  return [
    '🎊🎊🎊 10연승! 🎊🎊🎊',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '  👑 무적의 전사! 👑',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '🎁 특별 보상:',
    '   - 경험치 +1000',
    '   - 골드 +500',
    '   - 🎟️ 보물 상자 티켓 x1',
    '   - 🏅 칭호: "연승왕"',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '🔥 당신은 전설입니다!',
    '',
    '[⚔️ 계속] [🎁 상자 열기] [📊 프로필]',
  ];
}

function appendBattleLog(lines, battleLog) {
  if (!battleLog || battleLog.length === 0) {
    return;
  }

  lines.push('📜 전투 로그');
  lines.push(...battleLog.map((line) => `• ${line}`));
  lines.push(createDivider('short'));
}

function buildOngoingDescription({ character, session, battleLog }) {
  const zone = getZone(session.zone);
  const zoneLabel = zone ? `${zone.emoji} ${zone.name}` : session.zone;
  const monsterLevel = resolveMonsterLevel(session.monsterName, zone?.minLevel ?? 1);
  const monsterHpBar = createHPBar(session.monsterHp, session.monsterMaxHp, 10);
  const playerHpBar = createHPBar(session.playerHp, character.maxHp, 10);
  const currentMana = character.mana ?? 0;
  const maxMana = character.maxMana ?? Math.max(currentMana, 1);
  const playerManaBar = createHPBar(currentMana, maxMana, 10);
  const combatSkill = getCombatSkill(character);
  const lines = [];

  appendBattleLog(lines, battleLog);

  if (session.turn === 1) {
    const rareEncounterShowcase = buildRareMonsterEncounterShowcase(session, monsterLevel);
    if (rareEncounterShowcase) {
      lines.push(...rareEncounterShowcase);
      lines.push(createDivider('short'));
    }
  }

  lines.push(`👹 ${session.monsterName} Lv.${monsterLevel}`);
  lines.push(`❤️ ${monsterHpBar} ${session.monsterHp}/${session.monsterMaxHp} HP`);
  lines.push(`⚔️ 공격력: ${session.monsterAttack} | 🛡️ 방어력: ${session.monsterDefense}`);
  lines.push('');
  lines.push(createDivider());
  lines.push(`⚔️ ${character.name} (${localizeClassName(character.class)}) Lv.${character.level}`);
  lines.push(`❤️ ${playerHpBar} ${session.playerHp}/${character.maxHp} HP`);
  lines.push(`🔷 ${playerManaBar} ${currentMana}/${maxMana} MP`);
  
  // 경험치 진행도 표시
  const xpProgress = progressToNextLevel(character);
  if (xpProgress.required !== null) {
    const xpBar = createXPBar(character.xp, xpProgress.required, 10);
    const xpPercent = Math.floor(xpProgress.ratio * 100);
    lines.push(`📈 ${xpBar} ${character.xp}/${xpProgress.required} XP (${xpPercent}%)`);
  } else {
    lines.push(`📈 경험치: MAX (Lv.${character.level})`);
  }
  
  lines.push(`⚔️ 공격력: ${character.attack} | 🛡️ 방어력: ${character.defense}`);
  
  // 사용 가능한 스킬 목록
  const availableSkills = getAvailableSkills(character);
  if (availableSkills.length > 0) {
    const skillsText = availableSkills
      .map(
        (s) =>
          `${s.emoji} ${s.name}${s.skillLevel > 1 ? ` +${s.skillLevel}` : ''} (${s.manaCost} MP)${currentMana < s.manaCost ? ' ❌' : ''}`,
      )
      .join(', ');
    lines.push(`✨ 스킬: ${skillsText}`);
  }
  
  lines.push(`💊 포션: ${session.potionsRemaining}개`);
  lines.push('');
  lines.push(createDivider());
  lines.push(`🗺️ 지역: ${zoneLabel}`);
  lines.push(`🎲 턴 ${session.turn} | 🎯 당신의 차례!`);

  return lines.join('\n');
}

function buildVictoryDescription({
  character,
  session,
  battleLog,
  rewards,
  streakMilestone = null,
  levelUpDetails,
  droppedEquipment,
  droppedResource,
  droppedSkill,
}) {
  const playerHpBar = createHPBar(session.playerHp, character.maxHp, 10);
  const currentMana = character.mana ?? 0;
  const maxMana = character.maxMana ?? Math.max(currentMana, 1);
  const playerManaBar = createHPBar(currentMana, maxMana, 10);
  const lines = [];

  appendBattleLog(lines, battleLog);

  lines.push(createDivider());
  lines.push(`✨ ${session.monsterName} 처치!`);
  lines.push('');
  lines.push('📊 전투 결과');
  lines.push(`⏱️ 전투 시간: ${session.turn}턴`);
  lines.push(`❤️ 남은 체력: ${playerHpBar} ${session.playerHp}/${character.maxHp} HP`);
  lines.push(`🔷 남은 마나: ${playerManaBar} ${currentMana}/${maxMana} MP`);
  lines.push('');
  lines.push('🎁 보상');
  lines.push(`✨ 경험치 +${rewards?.xpReward ?? 0}`);
  const goldDelta = rewards?.goldReward ?? 0;
  lines.push(`💰 골드 ${goldDelta >= 0 ? '+' : ''}${goldDelta}G`);

  if ((rewards?.repairCost || 0) > 0) {
    lines.push(`🔧 수리비 -${rewards.repairCost}G`);
    const netGoldReward = rewards?.netGoldReward ?? 0;
    lines.push(`💵 실수령 ${netGoldReward >= 0 ? '+' : ''}${netGoldReward}G`);
  }

  if (streakMilestone === 5) {
    lines.push('');
    lines.push(...buildFiveWinStreakBonusShowcase());
  }

  if (streakMilestone === 10) {
    lines.push('');
    lines.push(...buildTenWinStreakBonusShowcase());
  }

  if (droppedEquipment) {
    const { RARITIES, EQUIPMENT_TYPES } = require('./equipment');
    const rarityData = RARITIES[droppedEquipment.rarity];
    const typeData = EQUIPMENT_TYPES[droppedEquipment.type];
    lines.push('');
    lines.push('🎊 장비 드롭!');
    lines.push(
      `${rarityData.emoji} ${typeData.emoji} **${droppedEquipment.name}** (${rarityData.name})`,
    );

    const stats = [];
    if (droppedEquipment.attack > 0) stats.push(`공격 +${droppedEquipment.attack}`);
    if (droppedEquipment.defense > 0) stats.push(`방어 +${droppedEquipment.defense}`);
    if (droppedEquipment.hp > 0) stats.push(`HP +${droppedEquipment.hp}`);
    if (droppedEquipment.mana > 0) stats.push(`MP +${droppedEquipment.mana}`);
    lines.push(`   ${stats.join(', ')}`);

    if (droppedEquipment.effect) {
      const { EFFECTS } = require('./equipment');
      const effectData = EFFECTS[droppedEquipment.effect];
      lines.push(`   ✨ ${effectData.emoji} ${effectData.name}`);
    }
  }

  if (droppedResource) {
    const { RESOURCES } = require('./production-classes');
    const resourceData = RESOURCES[droppedResource.type];
    if (resourceData) {
      lines.push('');
      lines.push('📦 자원 획득!');
      lines.push(`${resourceData.emoji} **${resourceData.name}** x${droppedResource.quantity}개`);
    }
  }

  if (droppedSkill) {
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('🎉🎉🎉 **희귀 스킬 드롭!!** 🎉🎉🎉');
    lines.push(`${droppedSkill.skillEmoji} **${droppedSkill.skillName}** 획득!`);
    lines.push('💡 /shop에서 스킬 상점 확인 가능');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  if (levelUpDetails) {
    const hpGain = levelUpDetails.after.maxHp - levelUpDetails.before.maxHp;
    const manaGain =
      (levelUpDetails.after.maxMana ?? 0) - (levelUpDetails.before.maxMana ?? 0);
    const attackGain = levelUpDetails.after.attack - levelUpDetails.before.attack;
    const defenseGain = levelUpDetails.after.defense - levelUpDetails.before.defense;

    lines.push('');
    lines.push(createDivider());
    lines.push('📈 레벨 업!');
    lines.push('');
    lines.push(`⚔️ Lv.${levelUpDetails.before.level} → Lv.${levelUpDetails.after.level}`);
    lines.push(
      `❤️ 최대 체력 +${hpGain} (${levelUpDetails.before.maxHp} → ${levelUpDetails.after.maxHp})`,
    );
    lines.push(
      `🔷 최대 마나 +${manaGain} (${levelUpDetails.before.maxMana ?? 0} → ${levelUpDetails.after.maxMana ?? 0})`,
    );
    lines.push(
      `⚔️ 공격력 +${attackGain} (${levelUpDetails.before.attack} → ${levelUpDetails.after.attack})`,
    );
    lines.push(
      `🛡️ 방어력 +${defenseGain} (${levelUpDetails.before.defense} → ${levelUpDetails.after.defense})`,
    );
    lines.push('');
    lines.push('🎊 축하합니다!');
  }

  lines.push(createDivider());

  return lines.join('\n');
}

function buildDefeatDescription({ character, session, battleLog }) {
  const hpBar = createHPBar(session.playerHp, character.maxHp, 10);
  const currentMana = character.mana ?? 0;
  const maxMana = character.maxMana ?? Math.max(currentMana, 1);
  const manaBar = createHPBar(currentMana, maxMana, 10);
  const lines = [];

  appendBattleLog(lines, battleLog);

  lines.push(createDivider());
  lines.push('💔 전투에서 쓰러졌습니다');
  lines.push(`❤️ 체력: ${hpBar} ${session.playerHp}/${character.maxHp} HP`);
  lines.push(`🔷 마나: ${manaBar} ${currentMana}/${maxMana} MP`);
  lines.push('');
  lines.push('🏥 마을에서 회복되었습니다');
  lines.push('💊 체력과 마나가 완전히 회복되었습니다');
  lines.push('');
  lines.push(createDivider());
  lines.push('💡 팁: 방어를 사용하면 받는 피해를 크게 줄일 수 있습니다.');

  return lines.join('\n');
}

function buildFledDescription({ character, session, battleLog }) {
  const hpBar = createHPBar(session.playerHp, character.maxHp, 10);
  const currentMana = character.mana ?? 0;
  const maxMana = character.maxMana ?? Math.max(currentMana, 1);
  const manaBar = createHPBar(currentMana, maxMana, 10);
  const lines = [];

  appendBattleLog(lines, battleLog);

  lines.push(createDivider());
  lines.push('💔 부상을 입었습니다');
  lines.push(`❤️ 체력: ${hpBar} ${session.playerHp}/${character.maxHp} HP`);
  lines.push(`🔷 마나: ${manaBar} ${currentMana}/${maxMana} MP`);
  lines.push('');
  lines.push('🏥 마을에서 회복 중...');
  lines.push('💊 체력과 마나가 절반으로 회복되었습니다');
  lines.push('');
  lines.push(createDivider());
  lines.push('💡 팁: 포션을 사용하면 전투 중 체력을 회복할 수 있습니다!');

  return lines.join('\n');
}

function buildResetDescription({ character, session, battleLog }) {
  const hpBar = createHPBar(session.playerHp, character.maxHp, 10);
  const currentMana = character.mana ?? 0;
  const maxMana = character.maxMana ?? Math.max(currentMana, 1);
  const manaBar = createHPBar(currentMana, maxMana, 10);
  const lines = [];

  appendBattleLog(lines, battleLog);

  lines.push(createDivider());
  lines.push('🔄 전투 리셋 완료');
  lines.push(`❤️ 체력: ${hpBar} ${session.playerHp}/${character.maxHp} HP`);
  lines.push(`🔷 마나: ${manaBar} ${currentMana}/${maxMana} MP`);
  lines.push('');
  lines.push('💊 체력과 마나가 완전히 회복되었습니다!');
  lines.push('');
  lines.push(createDivider());
  lines.push('✨ 다시 탐험을 시작하세요!');

  return lines.join('\n');
}

function resolveCombatColor(status, levelUpDetails) {
  if (status === 'victory' && levelUpDetails) {
    return EMBED_COLORS.levelUp;
  }

  if (status === 'victory') {
    return EMBED_COLORS.victory;
  }

  if (status === 'defeat') {
    return EMBED_COLORS.defeat;
  }

  if (status === 'fled') {
    return EMBED_COLORS.warning;
  }

  if (status === 'reset') {
    return EMBED_COLORS.warning;
  }

  return EMBED_COLORS.combat;
}

function createCombatEmbed({
  character,
  session,
  battleLog = [],
  title = null,
  status = 'ongoing',
  rewards = null,
  streakMilestone = null,
  levelUpDetails = null,
  droppedEquipment = null,
  droppedResource = null,
  droppedSkill = null,
}) {
  const resolvedTitle = title ?? combatResultTitle(status, session.monsterName);

  let description = buildOngoingDescription({
    character,
    session,
    battleLog,
  });

  if (status === 'victory') {
    description = buildVictoryDescription({
      character,
      session,
      battleLog,
      rewards,
      streakMilestone,
      levelUpDetails,
      droppedEquipment,
      droppedResource,
      droppedSkill,
    });
  }

  if (status === 'defeat') {
    description = buildDefeatDescription({
      character,
      session,
      battleLog,
    });
  }

  if (status === 'fled') {
    description = buildFledDescription({
      character,
      session,
      battleLog,
    });
  }

  if (status === 'reset') {
    description = buildResetDescription({
      character,
      session,
      battleLog,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(resolveCombatColor(status, levelUpDetails))
    .setTitle(resolvedTitle)
    .setDescription(description)
    .setFooter({
      text: '홈랜드 전투 시스템',
    });

  // 몬스터 이미지 추가 (있으면)
  if (session.monsterImageUrl) {
    embed.setThumbnail(session.monsterImageUrl);
  }

  return embed;
}

function applyDamageModifiers(rawDamage, options = {}) {
  const critChance = options.critChance ?? GLOBAL_CRITICAL_CHANCE;
  const critMultiplier = options.critMultiplier ?? GLOBAL_CRITICAL_MULTIPLIER;
  const dodgeChance = options.dodgeChance ?? 0;
  const allowCritical = options.allowCritical ?? true;

  const isDodged = dodgeChance > 0 && Math.random() < dodgeChance;
  if (isDodged) {
    return {
      damage: 0,
      isCritical: false,
      isDodged: true,
    };
  }

  const isCritical = allowCritical && Math.random() < critChance;
  let damage = Math.max(Math.round(rawDamage), 1);

  if (isCritical) {
    damage = Math.max(Math.round(damage * critMultiplier), 1);
  }

  return {
    damage,
    isCritical,
    isDodged: false,
  };
}

function rollDamage(attackPower, defenseValue, options = {}) {
  // 전투 밸런스: 고정 피해 루프를 피하되, 결과가 과도하게 흔들리지 않도록 분산을 제한한다.
  const variance = 0.85 + Math.random() * 0.3;
  const rawDamage = Math.round(attackPower * variance) - defenseValue;
  return applyDamageModifiers(rawDamage, options);
}

function buildCriticalAttackShowcase({
  monsterName,
  monsterHp,
  monsterMaxHp,
  damage,
}) {
  const monsterHpBar = createHPBar(monsterHp, monsterMaxHp, 10);

  return [
    '⚔️ 당신의 공격!',
    '',
    CRITICAL_LOG_MESSAGE,
    '━━━━━━━━━━━━━━━━━━',
    '  ⚡ CRITICAL HIT ⚡',
    '━━━━━━━━━━━━━━━━━━',
    '',
    `👹 ${monsterName}`,
    `   ❤️ ${monsterHpBar} ${monsterHp}/${monsterMaxHp} HP`,
    `   💀 -${damage} 데미지! (2배)`,
    '',
    '🎊 완벽한 일격이었다!',
  ].join('\n');
}

function buildDodgeShowcase({
  monsterName,
  playerName,
  playerHp,
  playerMaxHp,
}) {
  const playerHpBar = createHPBar(playerHp, playerMaxHp, 10);

  return [
    `👹 ${monsterName}의 공격!`,
    '',
    DODGE_LOG_MESSAGE,
    '━━━━━━━━━━━━━━━━━━',
    '  💨 MISS! 💨',
    '━━━━━━━━━━━━━━━━━━',
    '',
    `⚔️ ${playerName}`,
    `   ❤️ ${playerHpBar} ${playerHp}/${playerMaxHp} HP`,
    '   🌪️ 화려하게 피했다!',
    '',
    '💡 반격 기회!',
  ].join('\n');
}

function rollCombatRandomEvent() {
  if (Math.random() >= COMBAT_RANDOM_EVENT_CHANCE) {
    return null;
  }

  const randomEventType = COMBAT_RANDOM_EVENT_TYPES[randomInt(0, COMBAT_RANDOM_EVENT_TYPES.length - 1)];

  if (randomEventType === 'treasure') {
    return {
      goldDelta: 100,
      potionDelta: 2,
      hpDelta: 0,
      message: [
        '⚡ 랜덤 이벤트 발생!',
        '',
        '🎁 보물 상자 발견!',
        '> 골드 +100',
        '> 포션 +2',
      ].join('\n'),
    };
  }

  if (randomEventType === 'merchant') {
    return {
      goldDelta: 0,
      potionDelta: 0,
      hpDelta: 0,
      message: [
        '⚡ 랜덤 이벤트 발생!',
        '',
        '💎 숨겨진 상인 등장!',
        '> "흠... 이 검을 500골드에 팔지?"',
        '[✅ 구매] [❌ 거절]',
      ].join('\n'),
    };
  }

  return {
    goldDelta: 0,
    potionDelta: 0,
    hpDelta: -20,
    message: [
      '⚡ 랜덤 이벤트 발생!',
      '',
      '⚠️ 함정 발동!',
      '> 가시 함정에 걸렸다!',
      '> HP -20',
    ].join('\n'),
  };
}

function resolveCombatTurn({
  character,
  session,
  action,
  skillKey = null,
  selectedConsumable = null,
}) {
  let playerHp = session.playerHp;
  let playerMana = Math.max(character.mana ?? 0, 0);
  const maxMana = Math.max(character.maxMana ?? playerMana, 0);
  let monsterHp = session.monsterHp;
  let potionsRemaining = session.potionsRemaining;
  let playerDefending = false;
  let skillUsed = false;
  let consumedConsumableId = null;
  let randomEventGoldReward = 0;

  const battleLog = [];

  // Zone 3 선공 메커니즘: 첫 턴에 몬스터가 먼저 공격
  if (session.turn === 1 && session.monsterFirstStrike) {
    battleLog.push('⚠️ **위험지대 특수 메커니즘 발동!**');
    battleLog.push('💀 몬스터가 먼저 공격합니다!');
    battleLog.push('');

    const enemyFirstStrike = rollDamage(session.monsterAttack, character.defense, {
      critChance: GLOBAL_CRITICAL_CHANCE,
      critMultiplier: GLOBAL_CRITICAL_MULTIPLIER,
      dodgeChance: GLOBAL_EVASION_CHANCE,
    });

    if (enemyFirstStrike.isDodged) {
      battleLog.push(buildDodgeShowcase({
        monsterName: session.monsterName,
        playerName: character.name,
        playerHp,
        playerMaxHp: character.maxHp,
      }));
    } else {
      battleLog.push(`👹 ${session.monsterName}의 선제공격!`);
      playerHp = Math.max(playerHp - enemyFirstStrike.damage, 0);

      if (enemyFirstStrike.isCritical) {
        battleLog.push(CRITICAL_LOG_MESSAGE);
        battleLog.push('');
        battleLog.push('━━━━━━━━━━━━━━━━');
        battleLog.push('💀💀 **몬스터 치명타!!** 💀💀');
        battleLog.push('━━━━━━━━━━━━━━━━');
        battleLog.push('');
      }

      battleLog.push(`💔 **${enemyFirstStrike.damage}** 데미지를 받았습니다!`);
    }

    if (!enemyFirstStrike.isDodged && playerHp <= 0) {
      battleLog.push('');
      battleLog.push('☠️ 선제공격에 쓰러졌습니다...');

      return {
        status: 'defeat',
        battleLog,
        sessionUpdate: {
          monsterHp,
          playerHp: 0,
          potionsRemaining,
          playerDefending: false,
          turn: session.turn + 1,
        },
        characterUpdate: {
          hp: 0,
          mana: playerMana,
          winStreak: 0,
        },
        meta: {
          skillUsed,
          consumedConsumableId,
        },
      };
    }

    battleLog.push('');
  }

  if (action === COMBAT_ACTIONS.attack) {
    const playerStrike = rollDamage(character.attack, session.monsterDefense, {
      critChance: GLOBAL_CRITICAL_CHANCE,
      critMultiplier: GLOBAL_CRITICAL_MULTIPLIER,
      dodgeChance: GLOBAL_EVASION_CHANCE,
    });

    if (playerStrike.isDodged) {
      battleLog.push('⚔️ 당신의 공격!');
      battleLog.push(DODGE_LOG_MESSAGE);
      battleLog.push(`🌀 ${session.monsterName}이(가) 공격을 회피했습니다!`);
    } else {
      monsterHp = Math.max(monsterHp - playerStrike.damage, 0);

      if (playerStrike.isCritical) {
        battleLog.push(buildCriticalAttackShowcase({
          monsterName: session.monsterName,
          monsterHp,
          monsterMaxHp: session.monsterMaxHp,
          damage: playerStrike.damage,
        }));
      } else {
        battleLog.push('⚔️ 당신의 공격!');
        battleLog.push(`💔 ${session.monsterName}에게 ${playerStrike.damage} 데미지!`);
      }

      if (!playerStrike.isCritical && monsterHp <= 0) {
        battleLog.push('🎯 완벽한 일격이었습니다!');
      } else if (monsterHp <= session.monsterMaxHp * 0.2) {
        battleLog.push(`⚠️ ${session.monsterName}이(가) 위태롭습니다!`);
      }
    }
  }

  if (action === COMBAT_ACTIONS.skill) {
    // 기본 스킬 찾기
    let skill = skillKey ? getSkillByKey(character, skillKey) : getCombatSkill(character);
    let skillLevel = skill?.skillLevel || 1;

    // 기본 스킬 없으면 전직 스킬 확인
    if (!skill && skillKey && character.advancedClass) {
      const dbSkill = (character.skills || []).find((entry) => entry.skillKey === skillKey);
      if (dbSkill) {
        const advancedSkill = getAdvancedSkillByKey(character.advancedClass, skillKey);
        if (advancedSkill) {
          skill = advancedSkill;
          skillLevel = dbSkill.skillLevel || 1;
        }
      }
    }

    if (!skill) {
      battleLog.push('❌ 아직 사용할 수 있는 스킬이 없습니다.');
    } else {
      // 마나 체크
      if (playerMana < skill.manaCost) {
        battleLog.push(`❌ 마나가 부족합니다. (필요: ${skill.manaCost}, 현재: ${playerMana})`);
      } else {
        playerMana -= skill.manaCost;
        skillUsed = true;

        // 🎮 스킬 콤보 시스템
        recordSkillUse(session.id, skillKey || 'basic_attack');
        const combo = checkCombo(session.id);

        // 스킬 효과 실행 (레벨 적용)
        const skillEffect = skill.effect(character, {
          hp: monsterHp,
          maxHp: session.monsterMaxHp,
          attack: session.monsterAttack,
          defense: session.monsterDefense,
        }, skillLevel);

        // 🔥 콤보 데미지 계산
        let finalDamage = skillEffect.damage;
        if (combo) {
          finalDamage = calculateComboDamage(skillEffect.damage, combo);
        }

        const skillDamageResult = applyDamageModifiers(finalDamage, {
          critChance: GLOBAL_CRITICAL_CHANCE,
          critMultiplier: GLOBAL_CRITICAL_MULTIPLIER,
          dodgeChance: GLOBAL_EVASION_CHANCE,
          allowCritical: !skillEffect.critical,
        });

        finalDamage = skillDamageResult.damage;
        const isCritical = Boolean(skillEffect.critical || skillDamageResult.isCritical);

        if (!skillDamageResult.isDodged) {
          monsterHp = Math.max(monsterHp - finalDamage, 0);
        }
        battleLog.push(skillEffect.message);

        if (skillDamageResult.isDodged) {
          battleLog.push(DODGE_LOG_MESSAGE);
          battleLog.push(`🌀 ${session.monsterName}이(가) 스킬을 회피했습니다!`);
        } else {
          if (isCritical) {
            battleLog.push(buildCriticalAttackShowcase({
              monsterName: session.monsterName,
              monsterHp,
              monsterMaxHp: session.monsterMaxHp,
              damage: finalDamage,
            }));
          }

          // 🎯 콤보 시각 효과
          if (combo) {
            battleLog.push('');
            battleLog.push(getComboVisual(combo));
            if (isCritical) {
              battleLog.push(`💥💥 **크리티컬 콤보 ${finalDamage}** 💥💥`);
            } else {
              battleLog.push(`💥 **${finalDamage}** 콤보 데미지!`);
            }
          } else if (!isCritical) {
            battleLog.push(`💔 ${session.monsterName}에게 ${finalDamage} 데미지!`);
          }
        }

        if (monsterHp <= 0) {
          battleLog.push(`🔥 ${skill.name}의 위력으로 적을 쓰러뜨렸습니다!`);
        }
      }
    }
  }

  if (action === COMBAT_ACTIONS.defend) {
    playerDefending = true;
    battleLog.push('🛡️ 방어 태세를 취했습니다. 이번 턴 받는 피해가 감소합니다.');
  }

  if (action === COMBAT_ACTIONS.potion || action === COMBAT_ACTIONS.potionBase) {
    if (potionsRemaining <= 0) {
      battleLog.push('❌ 남은 포션이 없습니다.');
    } else if (playerHp >= character.maxHp) {
      battleLog.push('❤️ 체력이 이미 최대치입니다.');
    } else {
      const healing = Math.min(
        Math.max(20, Math.round(character.maxHp * 0.35)),
        character.maxHp - playerHp,
      );

      playerHp += healing;
      potionsRemaining -= 1;
      battleLog.push(`💊 포션 사용! 체력 ${healing} 회복`);
    }
  }

  if (action === COMBAT_ACTIONS.potionDb) {
    if (!selectedConsumable) {
      battleLog.push('❌ 사용할 포션을 찾을 수 없습니다.');
    } else {
      const effect = String(selectedConsumable.effect || '').toLowerCase();
      const power = Math.max(0, Number(selectedConsumable.power) || 0);
      const itemName = selectedConsumable.name || '포션';

      if (effect === 'heal_hp') {
        const healing = Math.min(power, Math.max(character.maxHp - playerHp, 0));
        playerHp += healing;
        consumedConsumableId = selectedConsumable.id;
        battleLog.push(`🧪 ${itemName} 사용! HP ${healing} 회복`);
      } else if (effect === 'heal_mp') {
        const manaRecovery = Math.min(power, Math.max(maxMana - playerMana, 0));
        playerMana += manaRecovery;
        consumedConsumableId = selectedConsumable.id;
        battleLog.push(`🧪 ${itemName} 사용! MP ${manaRecovery} 회복`);
      } else {
        battleLog.push('❌ 전투 중에는 이 포션을 사용할 수 없습니다.');
      }
    }
  }

  if (action === COMBAT_ACTIONS.auto) {
    // 오토 배틀: AI가 최적 행동 자동 선택
    battleLog.push('⚡ 오토 모드!');
    
    // 간단한 AI 로직: 스킬 > 공격
    const hasSkill = character.skills && character.skills.length > 0;
    const hasMana = playerMana >= 10;
    
    if (hasSkill && hasMana) {
      // 스킬 사용
      const skills = character.skills.filter(s => s.manaCost <= playerMana);
      if (skills.length > 0) {
        const randomSkill = skills[Math.floor(Math.random() * skills.length)];
        action = COMBAT_ACTIONS.skill;
        skillKey = randomSkill.skillKey;
        battleLog.push(`🤖 AI: ${randomSkill.name} 사용!`);
      } else {
        action = COMBAT_ACTIONS.attack;
        battleLog.push('🤖 AI: 일반 공격!');
      }
    } else {
      action = COMBAT_ACTIONS.attack;
      battleLog.push('🤖 AI: 일반 공격!');
    }
    
    // 계속 진행 (아래 로직으로 폴스루)
  }

  if (action === COMBAT_ACTIONS.reset) {
    // 전투 강제 리셋: 즉시 종료하고 완전 회복
    playerHp = character.maxHp;
    playerMana = maxMana;
    battleLog.push('🔄 전투를 리셋했습니다.');
    battleLog.push('💊 체력과 마나가 완전히 회복되었습니다.');
    battleLog.push(`❤️ HP: ${playerHp}/${character.maxHp}`);
    battleLog.push(`🔷 MP: ${playerMana}/${maxMana}`);

    return {
      status: 'reset',
      battleLog,
      sessionUpdate: {
        monsterHp,
        playerHp,
        potionsRemaining,
        playerDefending: false,
        turn: session.turn + 1,
      },
      characterUpdate: {
        hp: playerHp,
        mana: playerMana,
      },
      meta: {
        skillUsed,
        consumedConsumableId,
      },
    };
  }

  if (action === COMBAT_ACTIONS.flee) {
    // 도망은 의도적으로 리스크를 둔다: 성공 시 전투 종료, 실패 시 턴 소모.
    const fleeSuccess = Math.random() < 0.45;

    if (fleeSuccess) {
      const recoveredHp = Math.max(playerHp, Math.ceil(character.maxHp * 0.5));
      const recoveredMana = Math.max(playerMana, Math.ceil(maxMana * 0.5));
      const recoveredHpAmount = recoveredHp - playerHp;
      const recoveredManaAmount = recoveredMana - playerMana;

      playerHp = recoveredHp;
      playerMana = recoveredMana;
      battleLog.push('🏃 도망에 성공했습니다.');

      if (recoveredHpAmount > 0) {
        battleLog.push(`🏥 마을에서 체력을 ${recoveredHpAmount} 회복했습니다.`);
      }

      if (recoveredManaAmount > 0) {
        battleLog.push(`🔷 마을에서 마나를 ${recoveredManaAmount} 회복했습니다.`);
      }

      return {
        status: 'fled',
        battleLog,
        sessionUpdate: {
          monsterHp,
          playerHp,
          potionsRemaining,
          playerDefending: false,
          turn: session.turn + 1,
        },
        characterUpdate: {
          hp: playerHp,
          mana: playerMana,
        },
        meta: {
          skillUsed,
          consumedConsumableId,
        },
      };
    }

    battleLog.push('❌ 도망에 실패했습니다. 몬스터의 반격이 이어집니다!');
  }

  if (monsterHp > 0) {
    const randomEvent = rollCombatRandomEvent();
    if (randomEvent) {
      battleLog.push('');
      battleLog.push(randomEvent.message);
      randomEventGoldReward += randomEvent.goldDelta;
      potionsRemaining += randomEvent.potionDelta;
      playerHp = Math.max(playerHp + randomEvent.hpDelta, 1);
    }
  }

  if (monsterHp <= 0) {
    // 연승 업데이트
    const streakResult = updateWinStreak(character);
    const streakBonus = calculateStreakBonus(streakResult.newStreak);
    const premiumBenefits = resolvePremiumBenefits(character.premiumSubscription);

    // 존별 보상 배율
    const zoneData = getZoneWithTypeData(session.zone);
    const zoneGoldMult = zoneData?.typeData?.goldMultiplier || 1.0;
    const zoneXpMult = zoneData?.typeData?.xpMultiplier || 1.0;

    // 연승 + 존 보너스 적용
    let baseXpReward = session.monsterXpReward;
    const goldRoll = calculateCombatGoldReward({
      monsterGoldMin: session.monsterGoldMin,
      monsterGoldMax: session.monsterGoldMax,
      zoneGoldMultiplier: zoneGoldMult,
      streakGoldBonus: streakBonus.goldBonus,
      specialGoldBonus: streakBonus.specialRewards.gold,
      premiumGoldMultiplier: premiumBenefits.goldMultiplier,
      randomFn: Math.random,
    });

    const xpReward = Math.floor(
      (baseXpReward * zoneXpMult * (1 + streakBonus.xpBonus) + streakBonus.specialRewards.xp) *
        premiumBenefits.xpMultiplier,
    );
    const economyAdjustment = applyCombatEconomyAdjustments({
      currentGold: character.gold,
      grossGoldReward: goldRoll.grossReward,
      maxHp: character.maxHp,
      currentHp: playerHp,
      level: character.level,
      isDefeat: false,
    });
    const netGoldReward = Math.floor(
      economyAdjustment.nextGold - character.gold,
    );

    // 전투 종료 화면에서 레벨업 수치를 즉시 보여주기 위해 XP를 바로 반영한다.
    const leveling = applyExperience(character, xpReward, playerHp, playerMana);
    const recoveredMana = Math.min(
      leveling.characterUpdate.maxMana,
      leveling.characterUpdate.mana + Math.ceil(leveling.characterUpdate.maxMana * 0.3),
    );

    const characterUpdate = {
      ...leveling.characterUpdate,
      ...streakResult.updates,
      mana: recoveredMana,
      gold: economyAdjustment.nextGold + randomEventGoldReward,
      battleWins: (character.battleWins || 0) + 1,
    };

    battleLog.push(`🎁 경험치 +${xpReward}, 골드 +${goldRoll.grossReward}G 획득!`);
    if (economyAdjustment.appliedRepair > 0) {
      battleLog.push(`🔧 장비 수리비 -${economyAdjustment.appliedRepair}G`);
      battleLog.push(`💰 실수령 ${netGoldReward >= 0 ? '+' : ''}${netGoldReward}G`);
    }
    if (premiumBenefits.active) {
      battleLog.push(
        `👑 Premium 보너스: 경험치 +${Math.round((premiumBenefits.xpMultiplier - 1) * 100)}%, 골드 +${Math.round((premiumBenefits.goldMultiplier - 1) * 100)}%`,
      );
    }

    const streakMilestone = [5, 10].includes(streakResult.newStreak)
      ? streakResult.newStreak
      : null;

    // 5/10연승은 승리 임베드 전용 섹션에서 문구를 고정 출력한다.
    if (!streakMilestone && streakResult.messages.length > 0) {
      streakResult.messages.forEach((msg) => battleLog.push(msg));
    }

    if (recoveredMana > leveling.characterUpdate.mana) {
      battleLog.push(`🔷 전투 후 마나 ${recoveredMana - leveling.characterUpdate.mana} 회복`);
    }

    if (leveling.levelsGained > 0) {
      // 🎉 강화된 레벨업 연출
      const levelUpData = {
        oldLevel: character.level,
        newLevel: characterUpdate.level,
        levelsGained: leveling.levelsGained,
        statGains: {
          hp: leveling.characterUpdate.maxHp - character.maxHp,
          mp: leveling.characterUpdate.maxMana - (character.maxMana || 0),
          attack: leveling.characterUpdate.attack - character.attack,
          defense: leveling.characterUpdate.defense - character.defense,
          oldHp: character.maxHp,
          oldMp: character.maxMana || 0,
          oldAttack: character.attack,
          oldDefense: character.defense,
          newHp: leveling.characterUpdate.maxHp,
          newMp: leveling.characterUpdate.maxMana,
          newAttack: leveling.characterUpdate.attack,
          newDefense: leveling.characterUpdate.defense
        }
      };
      
      if (leveling.levelsGained >= 2) {
        battleLog.push(createMultiLevelUpMessage(levelUpData));
      } else {
        battleLog.push(createLevelUpMessage(levelUpData));
      }
    }

    const monsterData = getMonsterBySessionName(session.monsterName);
    const isBoss = Boolean(monsterData?.isBoss);

    // 숨겨진 던전 발견 체크 (보스 클리어 후 1%)
    let hiddenDungeonDiscovered = false;
    if (isBoss && session.zone === 'zone1') {
      const hiddenRoll = Math.random();
      if (hiddenRoll < 0.01) {
        // 1% 확률
        hiddenDungeonDiscovered = true;
      }
    }

    // 장비 드롭 체크
    let droppedEquipment = null;

    // 보스 스킬 드롭 체크 (전직 후 10% 확률)
    let droppedSkill = null;
    if (isBoss && character.advancedClass) {
      const skillDropRoll = Math.random();
      if (skillDropRoll < 0.1) { // 10% 확률
        const { getBossDropSkills } = require('./advanced-skills');
        const bossSkills = getBossDropSkills(character.advancedClass);
        const learnedKeys = new Set((character.skills || []).map((s) => s.skillKey));
        const unlearnedSkills = bossSkills.filter((skill) => !learnedKeys.has(skill.key));

        if (unlearnedSkills.length > 0) {
          const randomSkill = unlearnedSkills[randomInt(0, unlearnedSkills.length - 1)];
          droppedSkill = {
            skillKey: randomSkill.key,
            skillName: randomSkill.name,
            skillEmoji: randomSkill.emoji,
          };
        }
      }
    }

    if (isBoss) {
      const forcedRarity = resolveGuaranteedBossRarity(monsterData.guaranteedDrop);
      droppedEquipment = forcedRarity
        ? generateEquipment(characterUpdate.level, { rarity: forcedRarity })
        : generateEquipment(characterUpdate.level);
      battleLog.push('');
      battleLog.push('💀 보스 클리어! 확정 보상!');
      battleLog.push(`✨ ${droppedEquipment.name}을(를) 획득했습니다!`);
      
      if (droppedSkill) {
        battleLog.push('');
        battleLog.push('━━━━━━━━━━━━━━━━━━━━━━━━');
        battleLog.push('🎉🎉🎉 **희귀 스킬 드롭!!** 🎉🎉🎉');
        battleLog.push(`${droppedSkill.skillEmoji} **${droppedSkill.skillName}** 획득!`);
        battleLog.push('━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } else if (shouldDropEquipment()) {
      // 일반 몬스터 랜덤 드롭
      droppedEquipment = generateEquipment(characterUpdate.level);
      battleLog.push('');
      battleLog.push('✨ 장비 드롭!');
      battleLog.push(`${droppedEquipment.name}을(를) 획득했습니다!`);
    }

    // 자원 드롭 체크
    let droppedResource = null;
    const zone = getZone(session.zone);
    if (zone && zone.resourceDrops && zone.resourceDrops.length > 0) {
      const dropRoll = Math.random();
      if (dropRoll < (zone.dropChance || 0.3)) {
        // 랜덤 자원 선택
        const resourceType = zone.resourceDrops[randomInt(0, zone.resourceDrops.length - 1)];
        const quantity = randomInt(1, 3);

        droppedResource = {
          type: resourceType,
          quantity,
        };

        const { RESOURCES } = require('./production-classes');
        const resourceData = RESOURCES[resourceType];
        if (resourceData) {
          battleLog.push('');
          battleLog.push('📦 자원 획득!');
          battleLog.push(`${resourceData.emoji} ${resourceData.name} x${quantity}개`);
        }
      }
    }

    // 🎮 콤보 초기화 (전투 종료)
    clearCombo(session.id);

    return {
      status: 'victory',
      battleLog,
      sessionUpdate: {
        monsterHp,
        playerHp,
        potionsRemaining,
        playerDefending: false,
        turn: session.turn + 1,
      },
      characterUpdate,
      rewards: {
        xpReward,
        goldReward: goldRoll.grossReward,
        netGoldReward,
        repairCost: economyAdjustment.appliedRepair,
        levelsGained: leveling.levelsGained,
      },
      droppedEquipment,
      droppedResource,
      droppedSkill, // 보스 스킬 드롭
      meta: {
        skillUsed,
        streakMilestone,
        consumedConsumableId,
        hiddenDungeonDiscovered, // 숨겨진 던전 발견 여부
      },
    };
  }

  const enemyStrike = rollDamage(session.monsterAttack, character.defense, {
    critChance: GLOBAL_CRITICAL_CHANCE,
    critMultiplier: GLOBAL_CRITICAL_MULTIPLIER,
    dodgeChance: GLOBAL_EVASION_CHANCE,
  });
  const monsterData = getMonsterBySessionName(session.monsterName);
  const skillPatternResult = applyFieldBossSkillPatterns({
    monsterData,
    session: {
      ...session,
      playerHp,
    },
    character,
    currentMonsterHp: monsterHp,
    baseDamage: enemyStrike.damage,
  });

  monsterHp = skillPatternResult.monsterHp;
  let enemyDamage = skillPatternResult.enemyDamage;

  if (enemyStrike.isDodged) {
    enemyDamage = 0;
  }

  if (playerDefending && enemyDamage > 0) {
    enemyDamage = Math.max(1, Math.floor(enemyDamage * 0.45));
  }

  if (enemyDamage > 0) {
    playerHp = Math.max(playerHp - enemyDamage, 0);
  }

  battleLog.push('');
  if (skillPatternResult.logs.length > 0) {
    battleLog.push(...skillPatternResult.logs);
    battleLog.push('');
  }

  if (enemyStrike.isDodged) {
    battleLog.push(buildDodgeShowcase({
      monsterName: session.monsterName,
      playerName: character.name,
      playerHp,
      playerMaxHp: character.maxHp,
    }));
  } else {
    battleLog.push(`👹 ${session.monsterName}의 반격!`);
    if (enemyStrike.isCritical) {
      battleLog.push(CRITICAL_LOG_MESSAGE);
      battleLog.push('');
      battleLog.push('━━━━━━━━━━━━━━━━');
      battleLog.push('💀💀 **적의 치명타!!** 💀💀');
      battleLog.push('⚠️ CRITICAL DAMAGE ⚠️');
      battleLog.push('━━━━━━━━━━━━━━━━');
      battleLog.push('');
    }

    if (playerDefending && enemyDamage > 0) {
      battleLog.push('🛡️ 방어로 피해 감소!');
    }

    battleLog.push(`💔 **${enemyDamage}** 데미지를 받았습니다.`);
  }
  
  if (playerHp > 0 && playerHp <= character.maxHp * 0.3) {
    battleLog.push('⚠️ 위험! 체력이 낮습니다!');
  }

  if (playerHp <= 0) {
    battleLog.push('💀 쓰러졌습니다. 마을에서 회복됩니다.');

    // 연승 리셋
    const streakReset = resetWinStreak();
    if (character.winStreak > 0) {
      battleLog.push(`💔 ${character.winStreak}연승이 끊어졌습니다...`);
    }

    const defeatEconomy = applyCombatEconomyAdjustments({
      currentGold: character.gold,
      grossGoldReward: 0,
      maxHp: character.maxHp,
      currentHp: playerHp,
      level: character.level,
      isDefeat: true,
    });

    if (defeatEconomy.appliedRepair > 0) {
      battleLog.push(`🔧 수리비 -${defeatEconomy.appliedRepair}G`);
    }

    if (defeatEconomy.appliedDeathPenalty > 0) {
      battleLog.push(`💀 패배 페널티 -${defeatEconomy.appliedDeathPenalty}G`);
    }

    // 🎮 콤보 초기화 (전투 종료)
    clearCombo(session.id);

    return {
      status: 'defeat',
      battleLog,
      sessionUpdate: {
        monsterHp,
        playerHp,
        potionsRemaining,
        playerDefending: false,
        turn: session.turn + 1,
      },
      characterUpdate: {
        ...streakReset,
        gold: defeatEconomy.nextGold + randomEventGoldReward,
        hp: character.maxHp,
        mana: maxMana,
      },
      meta: {
        skillUsed,
        consumedConsumableId,
      },
    };
  }

  return {
    status: 'ongoing',
    battleLog,
    sessionUpdate: {
      monsterHp,
      playerHp,
      potionsRemaining,
      playerDefending: false,
      turn: session.turn + 1,
    },
    characterUpdate: {
      hp: playerHp,
      mana: playerMana,
      gold: character.gold + randomEventGoldReward,
    },
    meta: {
      skillUsed,
      consumedConsumableId,
    },
  };
}

function combatResultTitle(status, monsterName) {
  if (status === 'victory') {
    return '🎉🎉🎉 승리! 🎉🎉🎉';
  }

  if (status === 'defeat') {
    return '💀 패배... 다시 도전하세요!';
  }

  if (status === 'fled') {
    return '🏃 전투에서 도망쳤습니다!';
  }

  if (status === 'reset') {
    return '🔄 전투 리셋 완료!';
  }

  return `💀 전투 시작! - ${monsterName}`;
}

function buildLevelUpDetails(before, after, levelsGained) {
  const gained = levelsGained ?? 0;

  if (gained <= 0) {
    return null;
  }

  return {
    before: {
      level: before.level,
      maxHp: before.maxHp,
      maxMana: before.maxMana ?? 0,
      attack: before.attack,
      defense: before.defense,
    },
    after: {
      level: after.level,
      maxHp: after.maxHp,
      maxMana: after.maxMana ?? before.maxMana ?? 0,
      attack: after.attack,
      defense: after.defense,
    },
  };
}

async function handleCombatButton({ interaction, prisma }) {
  const parsed = parseCombatCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: '유효하지 않은 전투 버튼입니다.',
      ephemeral: true,
    });
    return true;
  }

  // Discord 3초 타임아웃 방지: DB 조회 전에 먼저 defer 처리
  await interaction.deferUpdate();

  const session = await prisma.combatSession.findUnique({
    where: {
      id: parsed.sessionId,
    },
    include: {
      character: {
        include: {
          skills: true,
          consumables: true,
          premiumSubscription: true,
        },
      },
    },
  });

  if (!session) {
    await interaction.editReply({
      content: '이 전투는 이미 종료되었습니다.',
      components: [],
    });

    return true;
  }

  if (session.character.userId !== interaction.user.id) {
    await interaction.followUp({
      content: '이 캐릭터의 소유자만 전투 버튼을 사용할 수 있습니다.',
      ephemeral: true,
    });

    return true;
  }

  const combatConsumablePotions = normalizeCombatConsumablePotions(
    session.character.consumables,
  );

  if (parsed.action === COMBAT_ACTIONS.potion) {
    await interaction.editReply({
      components: createCombatActionRows(session.id, {
        character: session.character,
        showPotionOptions: true,
        sessionPotionsRemaining: session.potionsRemaining,
        consumablePotions: combatConsumablePotions,
      }),
    });

    return true;
  }

  if (parsed.action === COMBAT_ACTIONS.potionCancel) {
    await interaction.editReply({
      components: createCombatActionRows(session.id, {
        character: session.character,
      }),
    });

    return true;
  }

  let selectedConsumable = null;

  if (parsed.action === COMBAT_ACTIONS.potionDb) {
    const consumableId = Number.parseInt(parsed.skillKey ?? '', 10);

    if (!Number.isInteger(consumableId)) {
      await interaction.followUp({
        content: '유효하지 않은 포션입니다.',
        ephemeral: true,
      });
      return true;
    }

    selectedConsumable = combatConsumablePotions.find((item) => item.id === consumableId) ?? null;
    if (!selectedConsumable) {
      await interaction.followUp({
        content: '전투에 사용할 수 있는 포션이 아닙니다.',
        ephemeral: true,
      });
      return true;
    }
  }

  const outcome = resolveCombatTurn({
    character: session.character,
    session,
    action: parsed.action,
    skillKey: parsed.skillKey,
    selectedConsumable,
  });

  // 캐릭터/세션 상태는 항상 함께 갱신되어야 하므로 트랜잭션으로 처리한다.
  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: {
        id: session.characterId,
      },
      data: outcome.characterUpdate,
    });

    if (outcome.meta?.consumedConsumableId) {
      const usedConsumable = await tx.consumable.findUnique({
        where: {
          id: outcome.meta.consumedConsumableId,
        },
      });

      if (usedConsumable && usedConsumable.characterId === session.characterId) {
        if (usedConsumable.quantity > 1) {
          await tx.consumable.update({
            where: {
              id: usedConsumable.id,
            },
            data: {
              quantity: usedConsumable.quantity - 1,
            },
          });
        } else {
          await tx.consumable.delete({
            where: {
              id: usedConsumable.id,
            },
          });
        }
      }
    }

    if (outcome.status === 'victory') {
      await tx.rankingEvent.create({
        data: {
          characterId: session.characterId,
          category: 'battle_wins',
          value: 1,
        },
      });
    }

    // 장비 드롭이 있으면 인벤토리에 추가
    if (outcome.droppedEquipment) {
      await tx.equipment.create({
        data: {
          characterId: session.characterId,
          name: outcome.droppedEquipment.name,
          type: outcome.droppedEquipment.type,
          rarity: outcome.droppedEquipment.rarity,
          attack: outcome.droppedEquipment.attack,
          defense: outcome.droppedEquipment.defense,
          hp: outcome.droppedEquipment.hp,
          mana: outcome.droppedEquipment.mana,
          effect: outcome.droppedEquipment.effect,
          equipped: false,
        },
      });
    }

    // 자원 드롭이 있으면 인벤토리에 추가
    if (outcome.droppedResource) {
      const { RESOURCES } = require('./production-classes');
      const resourceData = RESOURCES[outcome.droppedResource.type];

      const existing = await tx.resource.findUnique({
        where: {
          characterId_type: {
            characterId: session.characterId,
            type: outcome.droppedResource.type,
          },
        },
      });

      if (existing) {
        await tx.resource.update({
          where: {
            id: existing.id,
          },
          data: {
            quantity: existing.quantity + outcome.droppedResource.quantity,
          },
        });
      } else {
        await tx.resource.create({
          data: {
            characterId: session.characterId,
            type: outcome.droppedResource.type,
            name: resourceData.name,
            quantity: outcome.droppedResource.quantity,
          },
        });
      }
    }

    // 스킬 드롭이 있으면 스킬 추가
    if (outcome.droppedSkill) {
      await tx.skill.create({
        data: {
          characterId: session.characterId,
          skillKey: outcome.droppedSkill.skillKey,
          skillLevel: 1,
          equipped: false,
        },
      });
    }

    if (outcome.status === 'ongoing') {
      await tx.combatSession.update({
        where: {
          id: session.id,
        },
        data: outcome.sessionUpdate,
      });

      return;
    }

    await tx.combatSession.delete({
      where: {
        id: session.id,
      },
    });
  });

  const refreshedCharacter = {
    ...session.character,
    ...outcome.characterUpdate,
  };

  const refreshedSession = {
    ...session,
    ...outcome.sessionUpdate,
  };

  const ended = outcome.status !== 'ongoing';
  const levelUpDetails = buildLevelUpDetails(
    session.character,
    refreshedCharacter,
    outcome.rewards?.levelsGained ?? 0,
  );

  const embed = createCombatEmbed({
    character: refreshedCharacter,
    session: refreshedSession,
    battleLog: outcome.battleLog,
    title: combatResultTitle(outcome.status, session.monsterName),
    status: outcome.status,
    rewards: outcome.rewards,
    streakMilestone: outcome.meta?.streakMilestone ?? null,
    levelUpDetails,
    droppedEquipment: outcome.droppedEquipment,
    droppedResource: outcome.droppedResource,
    droppedSkill: outcome.droppedSkill,
  });

  const components = ended
    ? [createCombatEndActionRow(session.zone)]
    : createCombatActionRows(session.id, { character: refreshedCharacter });

  await interaction.editReply({
    embeds: [embed],
    components,
  });

  if (outcome.status === 'victory') {
    try {
      await recordDailyQuestProgress(
        prisma,
        session.characterId,
        DAILY_QUEST_EVENTS.KILL_MONSTER,
        1,
      );
    } catch (error) {
      console.error('Daily quest progress update failed (kill monster):', error);

    // Guild War contribution tracking
    try {
      if (interaction.client.guildWarSystem) {
        const isBoss = session.monsterName.includes('Boss') || session.monsterName.includes('Dragon') || session.monsterName.includes('Ancient');
        await interaction.client.guildWarSystem.recordContribution(
          session.characterId,
          isBoss ? 'BOSS_KILL' : 'MONSTER_KILL',
          1
        );
      }
    } catch (error) {
      console.error('Guild war contribution tracking failed:', error);
    }

      // 숨겨진 퀘스트 트리거 통계 업데이트
      try {
        const { updateHiddenQuestTriggerStats, checkAndDiscoverQuests } = require('./hidden-quest-handler');
        const monsterData = require('./monsters').MONSTERS;
        const monsterKey = Object.keys(monsterData).find(key => monsterData[key].name === session.monsterName);
        
        if (monsterKey) {
          await updateHiddenQuestTriggerStats(prisma, session.characterId, {
            type: 'monster_kill',
            monsterKey,
            zone: session.zone,
          });
          
          // 퀘스트 발견 체크
          const discoveries = await checkAndDiscoverQuests(prisma, interaction, session.characterId);
          
          // 발견된 퀘스트가 있으면 알림
          if (discoveries && discoveries.length > 0) {
            for (const discovery of discoveries) {
              // 다음 전투 후 알림 (별도 메시지로)
            }
          }
        }

          // 퀘스트 진행도 업데이트
          const { updateQuestProgress } = require('./hidden-quest-handler');
          await updateQuestProgress(prisma, session.characterId, monsterKey, session.zone);
      } catch (error) {
        console.error('Hidden quest trigger update failed:', error);
      }
    }


      // 숨겨진 던전 발견 시 별도 메시지
      if (outcome.meta?.hiddenDungeonDiscovered) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const hiddenEmbed = new EmbedBuilder()
          .setTitle('🚪 비밀 통로 발견!')
          .setDescription(
            '보스를 처치한 후, 벽 뒤에서 이상한 소리가 들립니다...\n\n' +
            '**오랜 세월 잠들어 있던 고대의 비밀이 드러났습니다!**\n\n' +
            '⚠️ 경고: 숨겨진 보스는 매우 강력합니다.\n' +
            '💎 보상: 전설 등급 장비 확정!'
          )
          .setColor(EMBED_COLORS.amber)
          .setTimestamp();
        
        const exploreButton = new ButtonBuilder()
          .setCustomId(`hidden_dungeon:explore:${session.characterId}`)
          .setLabel('조사하기')
          .setEmoji('🔍')
          .setStyle(ButtonStyle.Danger);
        
        const ignoreButton = new ButtonBuilder()
          .setCustomId(`hidden_dungeon:ignore:${session.characterId}`)
          .setLabel('무시하기')
          .setEmoji('🏃')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder().addComponents(exploreButton, ignoreButton);
        
        try {
          await interaction.followUp({
            embeds: [hiddenEmbed],
            components: [row],
            ephemeral: true,
          });
        } catch (error) {
          console.error('숨겨진 던전 메시지 전송 실패:', error);
        }
      }
    const onboardingFeedback = await handleOnboardingEvent({
      prisma,
      user: interaction.user,
      eventType: 'battle_won',
    });
    await sendOnboardingFeedback(interaction, onboardingFeedback);
  }

  if (outcome.meta?.skillUsed) {
    try {
      await recordDailyQuestProgress(
        prisma,
        session.characterId,
        DAILY_QUEST_EVENTS.USE_SKILL,
        1,
      );
    } catch (error) {
      console.error('Daily quest progress update failed (skill use):', error);
    }
  }

  return true;
}

module.exports = {
  COMBAT_ACTIONS,
  isCombatButton,
  parseCombatCustomId,
  isCombatEndButton,
  parseCombatEndCustomId,
  createCombatActionRows,
  createCombatEndActionRow,
  createCombatEmbed,
  resolveCombatTurn,
  handleCombatButton,
};
