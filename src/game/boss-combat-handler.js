const {
  parseBossCombatCustomId,
  createBossCombatEmbed,
  createBossCombatActionRow,
  applyBossSkillEffects,
  calculateBossDamageReduction,
  handleBossVictory,
} = require('./boss-combat');
const { getBossById } = require('./bosses');
const { calculateEquipmentStats } = require('./equipment');
const { getAvailableSkills, canUseSkill, getSkillByKey } = require('./skills');
const { EMBED_COLORS } = require('../utils/ui');

async function handleBossCombatAction({ interaction, prisma }) {
  // 버튼 interaction 처리를 위해 defer
  await interaction.deferUpdate();

  const parsed = parseBossCombatCustomId(interaction.customId);

  if (!parsed) {
    await interaction.editReply({
      content: '유효하지 않은 전투 액션입니다.',
    });
    return;
  }

  const { action, sessionId, skillKey } = parsed;

  // 세션 조회
  const session = await prisma.combatSession.findUnique({
    where: { id: sessionId },
    include: {
      character: {
        include: {
          equipment: { where: { equipped: true } },
          skills: true,
        },
      },
    },
  });

  if (!session) {
    await interaction.editReply({
      content: '전투 세션을 찾을 수 없습니다.',
    });
    return;
  }

  if (session.character.userId !== interaction.user.id) {
    await interaction.followUp({
      content: '다른 플레이어의 전투입니다.',
      ephemeral: true,
    });
    return;
  }

  const character = session.character;
  const boss = getBossById(session.bossId);

  if (!boss) {
    await interaction.editReply({
      content: '보스 데이터를 찾을 수 없습니다.',
    });
    return;
  }

  const equipStats = calculateEquipmentStats(character.equipment);
  const totalAttack = character.attack + equipStats.attack;
  const totalDefense = character.defense + equipStats.defense;
  const maxHp = character.maxHp + equipStats.hp;

  const combatLog = [];

  // 로컬 상태 추적 (stale session 데이터 문제 방지)
  let currentPlayerHp = session.playerHp;
  let currentBossHp = session.monsterHp;
  let currentPotions = session.potionsRemaining;
  let currentMana = character.mana || 0;
  // 이번 턴에 방어했는지 추적 (DB의 stale 값 대신 사용)
  let isDefendingThisTurn = false;

  // 플레이어 액션 처리
  let playerDamage = 0;

  if (action === 'attack') {
    const baseDamage = Math.max(1, totalAttack - session.monsterDefense);
    const variance = Math.floor(baseDamage * 0.2);
    playerDamage = baseDamage + Math.floor(Math.random() * variance);

    combatLog.push(`⚔️ 당신은 ${boss.name}에게 ${playerDamage} 피해를 입혔습니다!`);
  } else if (action === 'defend') {
    isDefendingThisTurn = true;
    combatLog.push('🛡️ 방어 태세를 취했습니다! (받는 피해 -50%)');
  } else if (action === 'potion') {
    if (currentPotions <= 0) {
      await interaction.editReply({
        content: '포션이 없습니다!',
      });
      return;
    }

    // 이미 최대 HP인 경우 포션 낭비 방지
    if (currentPlayerHp >= maxHp) {
      await interaction.editReply({
        content: '이미 체력이 최대치입니다!',
      });
      return;
    }

    const playerHealed = Math.min(80, maxHp - currentPlayerHp);
    currentPlayerHp += playerHealed;
    currentPotions -= 1;
    combatLog.push(`💊 포션을 사용하여 HP ${playerHealed} 회복!`);
  } else if (action === 'skill' && skillKey) {
    // 올바른 시그니처: getSkillByKey(character, skillKey)
    const skill = getSkillByKey(character, skillKey);

    // 올바른 시그니처: canUseSkill(character, skill)
    if (!skill) {
      await interaction.editReply({
        content: '이 스킬을 찾을 수 없습니다.',
      });
      return;
    }

    const useCheck = canUseSkill(character, skill);
    if (!useCheck.allowed) {
      await interaction.editReply({
        content: useCheck.reason || '이 스킬을 사용할 수 없습니다.',
      });
      return;
    }

    // 스킬 데미지 — skill.effect 함수를 사용하여 일관성 유지
    const skillEffect = skill.effect(
      { ...character, attack: totalAttack },
      {
        hp: currentBossHp,
        maxHp: session.monsterMaxHp,
        attack: session.monsterAttack,
        defense: session.monsterDefense,
      },
    );

    playerDamage = skillEffect.damage;
    combatLog.push(skillEffect.message);
    combatLog.push(`💔 ${boss.name}에게 ${playerDamage} 피해!`);

    if (skill.manaCost && skill.manaCost > 0) {
      currentMana = Math.max(0, currentMana - skill.manaCost);
    }
  } else if (action === 'flee') {
    // 도망 처리 — 보스전에서는 항상 실패하도록 처리
    combatLog.push('❌ 보스전에서는 도망칠 수 없습니다!');
  }

  // 보스 HP 감소
  currentBossHp = Math.max(0, currentBossHp - playerDamage);

  // 보스 처치 확인 — 트랜잭션으로 상태 저장 후 victory 처리
  if (currentBossHp <= 0) {
    await prisma.$transaction(async (tx) => {
      await tx.combatSession.update({
        where: { id: sessionId },
        data: {
          monsterHp: 0,
          playerHp: currentPlayerHp,
          potionsRemaining: currentPotions,
          playerDefending: false,
        },
      });

      if (currentMana !== (character.mana || 0)) {
        await tx.character.update({
          where: { id: character.id },
          data: { mana: currentMana },
        });
      }
    });

    const updatedSession = await prisma.combatSession.findUnique({
      where: { id: sessionId },
      include: {
        character: {
          include: {
            equipment: { where: { equipped: true } },
          },
        },
      },
    });

    await handleBossVictory({
      interaction,
      prisma,
      session: updatedSession,
      character: updatedSession.character,
      boss,
    });
    return;
  }

  // 보스 턴
  combatLog.push('');

  // 보스 스킬 효과 적용
  const baseBossDamage = Math.max(1, session.monsterAttack - totalDefense);
  const bossSkillResult = applyBossSkillEffects(
    boss,
    { ...session, monsterHp: currentBossHp },
    baseBossDamage,
  );

  combatLog.push(...bossSkillResult.logs);

  // 보스 회복
  if (bossSkillResult.healAmount > 0) {
    currentBossHp = Math.min(session.monsterMaxHp, currentBossHp + bossSkillResult.healAmount);
  }

  // 보스 공격 (회피하지 않은 경우)
  if (!bossSkillResult.dodged) {
    let bossDamage = bossSkillResult.finalDamage;

    // 이번 턴에 방어했는지 로컬 변수로 확인 (stale session 데이터 대신)
    if (isDefendingThisTurn) {
      bossDamage = Math.floor(bossDamage * 0.5);
      combatLog.push(`🛡️ 방어로 피해 감소! ${boss.name}의 공격 ${bossDamage} 피해`);
    } else {
      combatLog.push(`${boss.emoji} ${boss.name}의 공격! ${bossDamage} 피해`);
    }

    currentPlayerHp = Math.max(0, currentPlayerHp - bossDamage);
  }

  // 트랜잭션으로 모든 상태를 한번에 업데이트 (개별 update 호출 대신)
  await prisma.$transaction(async (tx) => {
    await tx.combatSession.update({
      where: { id: sessionId },
      data: {
        monsterHp: currentBossHp,
        playerHp: currentPlayerHp,
        potionsRemaining: currentPotions,
        playerDefending: isDefendingThisTurn,
        turn: session.turn + 1,
      },
    });

    if (currentMana !== (character.mana || 0)) {
      await tx.character.update({
        where: { id: character.id },
        data: { mana: currentMana },
      });
    }
  });

  // 플레이어 사망 확인
  if (currentPlayerHp <= 0) {
    await handleBossDefeat({ interaction, prisma, session, character, boss });
    return;
  }

  // 다음 턴 UI
  const updatedSession = await prisma.combatSession.findUnique({
    where: { id: sessionId },
    include: {
      character: {
        include: {
          equipment: { where: { equipped: true } },
          skills: true,
        },
      },
    },
  });

  const availableSkills = getAvailableSkills(updatedSession.character);

  const embed = await createBossCombatEmbed({
    session: updatedSession,
    character: updatedSession.character,
    boss,
    prisma,
    combatLog,
  });

  const actionRow = createBossCombatActionRow(updatedSession, availableSkills);

  // deferUpdate() 후에는 반드시 editReply() 사용 (update()는 에러 발생)
  await interaction.editReply({
    embeds: [embed],
    components: [actionRow],
  });
}

async function handleBossDefeat({ interaction, prisma, session, character, boss }) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const { createDivider } = require('../utils/ui');

  // 트랜잭션으로 세션 삭제 + HP 설정을 원자적으로 처리
  await prisma.$transaction(async (tx) => {
    await tx.combatSession.delete({
      where: { id: session.id },
    });

    // HP를 1로 설정
    await tx.character.update({
      where: { id: character.id },
      data: { hp: 1 },
    });
  });

  const defeatEmbed = new EmbedBuilder()
    .setColor(EMBED_COLORS.defeat || '#FF0000')
    .setTitle(`💀 패배...`)
    .setDescription(
      [
        createDivider(),
        `${boss.emoji} **${boss.name}**에게 패배했습니다...`,
        '',
        '보스는 여전히 그 자리에 있습니다.',
        '체력을 회복하고 다시 도전하세요!',
        '',
        createDivider(),
        '',
        '❤️ HP: 1 (사망)',
      ].join('\n'),
    )
    .setFooter({
      text: '보스 전투 패배',
    });

  const profileButton = new ButtonBuilder()
    .setCustomId('back_to_profile')
    .setLabel('프로필로')
    .setEmoji('👤')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(profileButton);

  await interaction.editReply({
    embeds: [defeatEmbed],
    components: [row],
  });
}

module.exports = {
  handleBossCombatAction,
};
