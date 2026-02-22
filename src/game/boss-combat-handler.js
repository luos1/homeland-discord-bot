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
  const parsed = parseBossCombatCustomId(interaction.customId);

  if (!parsed) {
    await interaction.reply({
      content: '유효하지 않은 전투 액션입니다.',
      ephemeral: true,
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
    await interaction.reply({
      content: '전투 세션을 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  if (session.character.userId !== interaction.user.id) {
    await interaction.reply({
      content: '다른 플레이어의 전투입니다.',
      ephemeral: true,
    });
    return;
  }

  const character = session.character;
  const boss = getBossById(session.bossId);

  if (!boss) {
    await interaction.reply({
      content: '보스 데이터를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const equipStats = calculateEquipmentStats(character.equipment);
  const totalAttack = character.attack + equipStats.attack;
  const totalDefense = character.defense + equipStats.defense;
  const maxHp = character.maxHp + equipStats.hp;

  const combatLog = [];

  // 플레이어 액션 처리
  let playerDamage = 0;
  let playerHealed = 0;

  if (action === 'attack') {
    const baseDamage = Math.max(1, totalAttack - session.monsterDefense);
    const variance = Math.floor(baseDamage * 0.2);
    playerDamage = baseDamage + Math.floor(Math.random() * variance);

    combatLog.push(`⚔️ 당신은 ${boss.name}에게 ${playerDamage} 피해를 입혔습니다!`);

    // 방어 태세 해제
    await prisma.combatSession.update({
      where: { id: sessionId },
      data: { playerDefending: false },
    });
  } else if (action === 'defend') {
    combatLog.push('🛡️ 방어 태세를 취했습니다! (받는 피해 -50%)');

    await prisma.combatSession.update({
      where: { id: sessionId },
      data: { playerDefending: true },
    });
  } else if (action === 'potion') {
    if (session.potionsRemaining <= 0) {
      await interaction.reply({
        content: '포션이 없습니다!',
        ephemeral: true,
      });
      return;
    }

    playerHealed = Math.min(80, maxHp - session.playerHp);
    combatLog.push(`💊 포션을 사용하여 HP ${playerHealed} 회복!`);

    await prisma.combatSession.update({
      where: { id: sessionId },
      data: {
        playerHp: session.playerHp + playerHealed,
        potionsRemaining: session.potionsRemaining - 1,
        playerDefending: false,
      },
    });
  } else if (action === 'skill' && skillKey) {
    const skill = await getSkillByKey(skillKey, character.skills);

    if (!skill || !canUseSkill(skill, character)) {
      await interaction.reply({
        content: '이 스킬을 사용할 수 없습니다.',
        ephemeral: true,
      });
      return;
    }

    // 스킬 데미지
    const skillDamage = Math.max(1, (totalAttack + skill.power) - session.monsterDefense);
    playerDamage = skillDamage;

    combatLog.push(
      `${skill.emoji || '✨'} **${skill.name}**! ${boss.name}에게 ${playerDamage} 피해!`,
    );

    if (skill.manaCost && skill.manaCost > 0) {
      await prisma.character.update({
        where: { id: character.id },
        data: {
          mana: Math.max(0, (character.mana || 0) - skill.manaCost),
        },
      });
    }

    await prisma.combatSession.update({
      where: { id: sessionId },
      data: { playerDefending: false },
    });
  }

  // 보스 HP 감소
  const newBossHp = Math.max(0, session.monsterHp - playerDamage);

  await prisma.combatSession.update({
    where: { id: sessionId },
    data: {
      monsterHp: newBossHp,
    },
  });

  // 보스 처치 확인
  if (newBossHp <= 0) {
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
    { ...session, monsterHp: newBossHp },
    baseBossDamage,
  );

  combatLog.push(...bossSkillResult.logs);

  // 보스 회복
  if (bossSkillResult.healAmount > 0) {
    const healedBossHp = Math.min(session.monsterMaxHp, newBossHp + bossSkillResult.healAmount);

    await prisma.combatSession.update({
      where: { id: sessionId },
      data: {
        monsterHp: healedBossHp,
      },
    });

    session.monsterHp = healedBossHp;
  }

  // 보스 공격 (회피하지 않은 경우)
  if (!bossSkillResult.dodged) {
    let bossDamage = bossSkillResult.finalDamage;

    if (session.playerDefending) {
      bossDamage = Math.floor(bossDamage * 0.5);
      combatLog.push(`🛡️ 방어로 피해 감소! ${boss.name}의 공격 ${bossDamage} 피해`);
    } else {
      combatLog.push(`${boss.emoji} ${boss.name}의 공격! ${bossDamage} 피해`);
    }

    const newPlayerHp = Math.max(0, session.playerHp - bossDamage);

    await prisma.combatSession.update({
      where: { id: sessionId },
      data: {
        playerHp: newPlayerHp,
      },
    });

    // 플레이어 사망 확인
    if (newPlayerHp <= 0) {
      await handleBossDefeat({ interaction, prisma, session, character, boss });
      return;
    }
  }

  // 턴 증가
  await prisma.combatSession.update({
    where: { id: sessionId },
    data: {
      turn: session.turn + 1,
    },
  });

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

  await interaction.update({
    embeds: [embed],
    components: [actionRow],
  });
}

async function handleBossDefeat({ interaction, prisma, session, character, boss }) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const { createDivider } = require('../utils/ui');

  // 전투 세션 삭제
  await prisma.combatSession.delete({
    where: { id: session.id },
  });

  // HP를 1로 설정
  await prisma.character.update({
    where: { id: character.id },
    data: { hp: 1 },
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
