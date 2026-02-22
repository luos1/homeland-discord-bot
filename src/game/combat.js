const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { applyExperience } = require('./leveling');
const { MONSTERS, getZone, randomInt } = require('./monsters');
const { getCombatSkill } = require('./skills');
const {
  EMBED_COLORS,
  createDivider,
  createHPBar,
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
};

const COMBAT_END_ACTIONS = {
  retry: 'retry',
  zones: 'zones',
};

function buildCombatCustomId(action, sessionId) {
  return `${COMBAT_PREFIX}:${action}:${sessionId}`;
}

function parseCombatCustomId(customId) {
  if (!customId || !customId.startsWith(`${COMBAT_PREFIX}:`)) {
    return null;
  }

  const parts = customId.split(':');

  if (parts.length !== 3) {
    return null;
  }

  const [, action, sessionId] = parts;

  if (!COMBAT_ACTIONS[action] || !sessionId) {
    return null;
  }

  return {
    action,
    sessionId,
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

function createCombatActionRow(sessionId, options = {}) {
  const disabled = options.disabled ?? false;
  const character = options.character ?? null;
  const skill = character ? getCombatSkill(character) : null;
  const currentMana = character?.mana ?? 0;
  const skillDisabled = disabled || !skill || currentMana < skill.manaCost;
  const skillLabel = skill?.name ?? '스킬 없음';
  const skillEmoji = skill?.emoji ?? '✨';

  return new ActionRowBuilder().addComponents(
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
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.skill, sessionId))
      .setLabel(skillLabel)
      .setEmoji(skillEmoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(skillDisabled),
    new ButtonBuilder()
      .setCustomId(buildCombatCustomId(COMBAT_ACTIONS.flee, sessionId))
      .setLabel('도망')
      .setEmoji('🏃')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
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
  lines.push(`⚔️ 공격력: ${character.attack} | 🛡️ 방어력: ${character.defense}`);
  if (combatSkill) {
    lines.push(`${combatSkill.emoji} 스킬: ${combatSkill.name} (${combatSkill.manaCost} MP)`);
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
  lines.push('🎲 아이템 드롭 확인 중...');

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

function resolveCombatTurn({ character, session, action }) {
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
      battleLog.push('💥 크리티컬 히트!');
    }

    battleLog.push(`💔 ${session.monsterName}에게 ${playerStrike.damage} 데미지`);
  }

  if (action === COMBAT_ACTIONS.skill) {
    const skill = getCombatSkill(character);

    if (!skill) {
      battleLog.push('❌ 아직 사용할 수 있는 스킬이 없습니다.');
    } else if (playerMana < skill.manaCost) {
      battleLog.push(`❌ 마나가 부족합니다. (${playerMana}/${skill.manaCost} MP)`);
    } else {
      playerMana -= skill.manaCost;

      const skillStrike = rollDamage(
        Math.round(character.attack * skill.damageMultiplier),
        Math.floor(session.monsterDefense * 0.7),
        {
          critChance: Math.min(0.45, 0.12 + (skill.critChanceBonus ?? 0)),
          critMultiplier: skill.critMultiplier ?? 1.75,
        },
      );

      monsterHp = Math.max(monsterHp - skillStrike.damage, 0);
      battleLog.push(`${skill.emoji} ${skill.name} 시전! (${skill.manaCost} MP 소모)`);

      if (skillStrike.isCritical) {
        battleLog.push('💥 스킬 크리티컬!');
      }

      battleLog.push(`💔 ${session.monsterName}에게 ${skillStrike.damage} 스킬 데미지`);
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
    const xpReward = session.monsterXpReward;
    const goldReward = randomInt(session.monsterGoldMin, session.monsterGoldMax);

    // 전투 종료 화면에서 레벨업 수치를 즉시 보여주기 위해 XP를 바로 반영한다.
    const leveling = applyExperience(character, xpReward, playerHp, playerMana);
    const recoveredMana = Math.min(
      leveling.characterUpdate.maxMana,
      leveling.characterUpdate.mana + Math.ceil(leveling.characterUpdate.maxMana * 0.3),
    );

    const characterUpdate = {
      ...leveling.characterUpdate,
      mana: recoveredMana,
      gold: character.gold + goldReward,
    };

    battleLog.push(`🎁 경험치 +${xpReward}, 골드 +${goldReward}G 획득!`);

    if (recoveredMana > leveling.characterUpdate.mana) {
      battleLog.push(`🔷 전투 후 마나 ${recoveredMana - leveling.characterUpdate.mana} 회복`);
    }

    if (leveling.levelsGained > 0) {
      battleLog.push(
        `📈 레벨 업! +${leveling.levelsGained}레벨 달성 (현재 Lv.${characterUpdate.level})`,
      );
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

  if (enemyStrike.isCritical) {
    battleLog.push(`💥 ${session.monsterName}의 크리티컬 공격!`);
  }

  battleLog.push(`💔 ${session.monsterName}에게 ${enemyDamage} 데미지를 받았습니다.`);

  if (playerHp <= 0) {
    battleLog.push('💀 쓰러졌습니다. 마을에서 회복됩니다.');

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
    return '🎉 승리!';
  }

  if (status === 'defeat') {
    return '💀 패배...';
  }

  if (status === 'fled') {
    return '🏃 전투에서 도망쳤습니다!';
  }

  return `⚔️ 전투 - ${monsterName}`;
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
      character: true,
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
  });

  // 캐릭터/세션 상태는 항상 함께 갱신되어야 하므로 트랜잭션으로 처리한다.
  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: {
        id: session.characterId,
      },
      data: outcome.characterUpdate,
    });

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
  });

  const components = ended
    ? [createCombatEndActionRow(session.zone)]
    : [createCombatActionRow(session.id, { character: refreshedCharacter })];

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
  createCombatActionRow,
  createCombatEndActionRow,
  createCombatEmbed,
  resolveCombatTurn,
  handleCombatButton,
};
