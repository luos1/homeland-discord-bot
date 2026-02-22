const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { applyExperience, progressToNextLevel } = require('./leveling');
const { MONSTERS, getZone, randomInt, rollRareMonster, applyRareModifier } = require('./monsters');
const { getCombatSkill, getAvailableSkills, getSkillByKey, canUseSkill } = require('./skills');
const { shouldDropEquipment, generateEquipment } = require('./equipment');
const { calculateStreakBonus, updateWinStreak, resetWinStreak } = require('./streak');
const { getAdvancedSkillByKey } = require('./advanced-skills');
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
  skill: 'skill',
  flee: 'flee',
  reset: 'reset',
};

const COMBAT_END_ACTIONS = {
  retry: 'retry',
  zones: 'zones',
};

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

  if (!COMBAT_ACTIONS[action] || !sessionId) {
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

function createCombatActionRows(sessionId, options = {}) {
  const disabled = options.disabled ?? false;
  const character = options.character ?? null;
  const currentMana = character?.mana ?? 0;

  // 첫 번째 줄: 기본 액션
  const mainRow = new ActionRowBuilder().addComponents(
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
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.potion, sessionId))
      .setLabel('포션')
      .setEmoji('💊')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.flee, sessionId))
      .setLabel('도망')
      .setEmoji('🏃')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );

  const rows = [mainRow];

  // 두 번째 줄: 스킬 (기본 스킬 + 전직 스킬)
  if (character) {
    // 기본 스킬
    const basicSkills = getAvailableSkills(character);
    
    // 전직 스킬 (DB에서 가져온 스킬 - 모두 표시)
    const advancedSkills = (character.skills || [])
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

    // 합치기 (최대 5개)
    const allSkills = [...basicSkills, ...advancedSkills].slice(0, 5);

    if (allSkills.length > 0) {
      const skillButtons = allSkills.map((skill) => {
        const canUse = currentMana >= skill.manaCost;
        const label = skill.dbSkillLevel 
          ? `${skill.name} +${skill.dbSkillLevel} (${skill.manaCost} MP)`
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
  const matched = Object.values(MONSTERS).find((monster) => monster.name === monsterName);
  return matched?.level ?? fallbackLevel;
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
          `${s.emoji} ${s.name} (${s.manaCost} MP)${currentMana < s.manaCost ? ' ❌' : ''}`,
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
  levelUpDetails,
  droppedEquipment,
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
  lines.push(`💰 골드 +${rewards?.goldReward ?? 0}G`);

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
  levelUpDetails = null,
  droppedEquipment = null,
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
      levelUpDetails,
      droppedEquipment,
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

  return new EmbedBuilder()
    .setColor(resolveCombatColor(status, levelUpDetails))
    .setTitle(resolvedTitle)
    .setDescription(description)
    .setFooter({
      text: '홈랜드 전투 시스템',
    });
}

function rollDamage(attackPower, defenseValue, options = {}) {
  const critChance = options.critChance ?? 0;
  const critMultiplier = options.critMultiplier ?? 1.6;

  // 전투 밸런스: 고정 피해 루프를 피하되, 결과가 과도하게 흔들리지 않도록 분산을 제한한다.
  const variance = 0.85 + Math.random() * 0.3;
  let rawDamage = Math.round(attackPower * variance) - defenseValue;
  const isCritical = Math.random() < critChance;

  if (isCritical) {
    rawDamage = Math.round(rawDamage * critMultiplier);
  }

  return {
    damage: Math.max(rawDamage, 1),
    isCritical,
  };
}

function resolveCombatTurn({ character, session, action, skillKey = null }) {
  let playerHp = session.playerHp;
  let playerMana = Math.max(character.mana ?? 0, 0);
  const maxMana = Math.max(character.maxMana ?? playerMana, 0);
  let monsterHp = session.monsterHp;
  let potionsRemaining = session.potionsRemaining;
  let playerDefending = false;

  const battleLog = [];

  if (action === COMBAT_ACTIONS.attack) {
    const playerStrike = rollDamage(character.attack, session.monsterDefense, {
      critChance: 0.15,
      critMultiplier: 1.65,
    });

    monsterHp = Math.max(monsterHp - playerStrike.damage, 0);
    battleLog.push('⚔️ 당신의 공격!');

    if (playerStrike.isCritical) {
      battleLog.push('');
      battleLog.push('💥💥💥 치명타!! 💥💥💥');
      battleLog.push('⚡ CRITICAL HIT ⚡');
      battleLog.push('');
    }

    battleLog.push(`💔 ${session.monsterName}에게 ${playerStrike.damage} 데미지!`);
    
    if (monsterHp <= 0) {
      battleLog.push('🎯 완벽한 일격이었습니다!');
    } else if (monsterHp <= session.monsterMaxHp * 0.2) {
      battleLog.push(`⚠️ ${session.monsterName}이(가) 위태롭습니다!`);
    }
  }

  if (action === COMBAT_ACTIONS.skill) {
    // 기본 스킬 찾기
    let skill = skillKey ? getSkillByKey(character, skillKey) : getCombatSkill(character);
    let skillLevel = 1;

    // 기본 스킬 없으면 전직 스킬 확인
    if (!skill && skillKey && character.advancedClass) {
      const dbSkill = (character.skills || []).find(s => s.skillKey === skillKey);
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

        // 스킬 효과 실행 (레벨 적용)
        const skillEffect = skill.effect(character, {
          hp: monsterHp,
          maxHp: session.monsterMaxHp,
          attack: session.monsterAttack,
          defense: session.monsterDefense,
        }, skillLevel);

        monsterHp = Math.max(monsterHp - skillEffect.damage, 0);
        battleLog.push(skillEffect.message);
        battleLog.push(`💔 ${session.monsterName}에게 ${skillEffect.damage} 데미지!`);

        if (skillEffect.critical) {
          battleLog.push('');
          battleLog.push('✨✨✨ 완벽한 일격! ✨✨✨');
          battleLog.push('');
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

  if (action === COMBAT_ACTIONS.potion) {
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
      };
    }

    battleLog.push('❌ 도망에 실패했습니다. 몬스터의 반격이 이어집니다!');
  }

  if (monsterHp <= 0) {
    // 연승 업데이트
    const streakResult = updateWinStreak(character);
    const streakBonus = calculateStreakBonus(streakResult.newStreak);

    // 연승 보너스 적용
    let baseXpReward = session.monsterXpReward;
    let baseGoldReward = randomInt(session.monsterGoldMin, session.monsterGoldMax);

    const xpReward = Math.floor(
      baseXpReward * (1 + streakBonus.xpBonus) + streakBonus.specialRewards.xp,
    );
    const goldReward = Math.floor(
      baseGoldReward * (1 + streakBonus.goldBonus) + streakBonus.specialRewards.gold,
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
      gold: character.gold + goldReward,
    };

    battleLog.push(`🎁 경험치 +${xpReward}, 골드 +${goldReward}G 획득!`);

    // 연승 메시지 추가
    if (streakResult.messages.length > 0) {
      battleLog.push('');
      streakResult.messages.forEach((msg) => battleLog.push(msg));
    }

    if (recoveredMana > leveling.characterUpdate.mana) {
      battleLog.push(`🔷 전투 후 마나 ${recoveredMana - leveling.characterUpdate.mana} 회복`);
    }

    if (leveling.levelsGained > 0) {
      battleLog.push(
        `📈 레벨 업! +${leveling.levelsGained}레벨 달성 (현재 Lv.${characterUpdate.level})`,
      );
    }

    // 장비 드롭 체크
    let droppedEquipment = null;
    if (shouldDropEquipment()) {
      droppedEquipment = generateEquipment(characterUpdate.level);
      battleLog.push('');
      battleLog.push('✨ 장비 드롭!');
      battleLog.push(`${droppedEquipment.name}을(를) 획득했습니다!`);
    }

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
        goldReward,
        levelsGained: leveling.levelsGained,
      },
      droppedEquipment,
    };
  }

  const enemyStrike = rollDamage(session.monsterAttack, character.defense, {
    critChance: 0.08,
    critMultiplier: 1.5,
  });
  let enemyDamage = enemyStrike.damage;

  if (playerDefending) {
    enemyDamage = Math.max(1, Math.floor(enemyDamage * 0.45));
  }

  playerHp = Math.max(playerHp - enemyDamage, 0);

  battleLog.push('');
  battleLog.push(`👹 ${session.monsterName}의 반격!`);
  
  if (enemyStrike.isCritical) {
    battleLog.push('💥 적의 크리티컬 공격!');
    battleLog.push('⚠️ CRITICAL DAMAGE ⚠️');
  }

  if (playerDefending) {
    battleLog.push('🛡️ 방어로 피해 감소!');
  }

  battleLog.push(`💔 ${enemyDamage} 데미지를 받았습니다.`);
  
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
        hp: character.maxHp,
        mana: maxMana,
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
    return false;
  }

  const session = await prisma.combatSession.findUnique({
    where: {
      id: parsed.sessionId,
    },
    include: {
      character: {
        include: {
          skills: true,
        },
      },
    },
  });

  if (!session) {
    await interaction.reply({
      content: '이 전투는 이미 종료되었습니다.',
      ephemeral: true,
    });

    return true;
  }

  if (session.character.userId !== interaction.user.id) {
    await interaction.reply({
      content: '이 캐릭터의 소유자만 전투 버튼을 사용할 수 있습니다.',
      ephemeral: true,
    });

    return true;
  }

  await interaction.deferUpdate();

  const outcome = resolveCombatTurn({
    character: session.character,
    session,
    action: parsed.action,
    skillKey: parsed.skillKey,
  });

  // 캐릭터/세션 상태는 항상 함께 갱신되어야 하므로 트랜잭션으로 처리한다.
  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: {
        id: session.characterId,
      },
      data: outcome.characterUpdate,
    });

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
    levelUpDetails,
    droppedEquipment: outcome.droppedEquipment,
  });

  const components = ended
    ? [createCombatEndActionRow(session.zone)]
    : createCombatActionRows(session.id, { character: refreshedCharacter });

  await interaction.editReply({
    embeds: [embed],
    components,
  });

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
