const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { requireCharacter } = require('../utils/response-helpers');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { generateEquipment } = require('../game/equipment');

/**
 * 🎯 서버 추가 보상 시스템
 * 
 * 봇을 새로운 서버에 초대한 사용자에게 보상:
 * - 레전더리 장비
 * - 프리미엄 7일
 */

const SERVER_INVITE_REWARDS = {
  equipmentRarity: 'legendary',
  premiumDays: 7,
  gems: 500,
};

async function grantServerInviteReward(prisma, userId, guildId, guildName) {
  // 이미 받았는지 확인
  const existingReward = await prisma.serverInviteReward.findUnique({
    where: {
      userId_guildId: {
        userId,
        guildId,
      },
    },
  });

  if (existingReward) {
    return {
      success: false,
      alreadyClaimed: true,
      error: '이미 이 서버에 대한 보상을 받았습니다.',
    };
  }

  const character = await prisma.character.findUnique({
    where: { userId },
    select: { id: true, level: true },
  });

  if (!character) {
    return {
      success: false,
      alreadyClaimed: false,
      error: '캐릭터를 먼저 생성해주세요. (/create)',
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    // 레전더리 장비 지급
    const equipment = generateEquipment(character.level, {
      rarity: SERVER_INVITE_REWARDS.equipmentRarity,
    });

    const grantedEquipment = await tx.equipment.create({
      data: {
        characterId: character.id,
        name: equipment.name,
        type: equipment.type,
        rarity: equipment.rarity,
        attack: equipment.attack,
        defense: equipment.defense,
        hp: equipment.hp,
        mana: equipment.mana,
        effect: equipment.effect,
        equipped: false,
      },
    });

    // 젬 지급
    await tx.character.update({
      where: { id: character.id },
      data: {
        gems: { increment: SERVER_INVITE_REWARDS.gems },
      },
    });

    // 프리미엄 7일 지급
    const now = new Date();
    const existingSub = await tx.premiumSubscription.findUnique({
      where: { userId },
    });

    if (existingSub) {
      const currentEnd = new Date(existingSub.endDate);
      const newEnd = new Date(Math.max(currentEnd.getTime(), now.getTime()) + SERVER_INVITE_REWARDS.premiumDays * 24 * 60 * 60 * 1000);
      await tx.premiumSubscription.update({
        where: { userId },
        data: { endDate: newEnd },
      });
    } else {
      const endDate = new Date(now.getTime() + SERVER_INVITE_REWARDS.premiumDays * 24 * 60 * 60 * 1000);
      await tx.premiumSubscription.create({
        data: {
          userId,
          planId: 'server_invite',
          tier: 'bronze',
          startDate: now,
          endDate,
        },
      });
    }

    // 보상 기록
    await tx.serverInviteReward.create({
      data: {
        userId,
        guildId,
        guildName,
        rewardClaimed: true,
        rewardGold: 0,
        rewardGems: SERVER_INVITE_REWARDS.gems,
      },
    });

    return { grantedEquipment };
  });

  return {
    success: true,
    alreadyClaimed: false,
    grantedEquipment: result.grantedEquipment,
    rewards: SERVER_INVITE_REWARDS,
  };
}

async function getServerInviteRewards(prisma, userId) {
  const rewards = await prisma.serverInviteReward.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return rewards;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-rewards')
    .setNameLocalizations({ 'en-US': 'server-rewards' })
    .setDescription('서버 초대 보상 확인 및 수령')
    .setDescriptionLocalizations({ 'en-US': 'Check and claim server invite rewards' })
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('현재 서버에 대한 초대 보상 수령')
        .setDescriptionLocalizations({ 'en-US': 'Claim server invite rewards' })
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('받은 서버 초대 보상 목록 확인')
        .setDescriptionLocalizations({ 'en-US': 'List claimed server invite rewards' })
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'claim') {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name || 'Unknown Server';

      if (!guildId) {
        await interaction.reply({
          content: '❌ 이 명령어는 서버에서만 사용할 수 있습니다.',
          ephemeral: true,
        });
        return;
      }

      const result = await grantServerInviteReward(
        prisma,
        interaction.user.id,
        guildId,
        guildName
      );

      if (!result.success) {
        await interaction.reply({
          content: `❌ ${result.error}`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.victory)
        .setTitle('🎉 서버 초대 보상 지급!')
        .setDescription(
          [
            createDivider(),
            `**${guildName}** 서버에 홈랜드 봇을 초대해주셔서 감사합니다!`,
            '',
            '🎁 보상:',
            `  • 💎 젬 +${formatNumber(result.rewards.gems)}`,
            `  • 🌟 ${result.grantedEquipment.name} (레전더리 장비)`,
            `  • 👑 프리미엄 +${result.rewards.premiumDays}일`,
            createDivider(),
            '💡 **추가 혜택**: 친구들도 이 서버에서 초대 코드로 보상을 받을 수 있습니다!',
          ].join('\n')
        )
        .setFooter({ text: '홈랜드 성장 감사 이벤트' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'list') {
      const character = await requireCharacter(prisma, interaction);
      if (!character) return;

      const rewards = await getServerInviteRewards(prisma, interaction.user.id);

      if (rewards.length === 0) {
        await interaction.reply({
          content: '아직 받은 서버 초대 보상이 없습니다. `/server-rewards claim`으로 보상을 받으세요!',
          ephemeral: true,
        });
        return;
      }

      const rewardLines = rewards.map((reward, index) => {
        const date = reward.createdAt.toLocaleDateString('ko-KR');
        return `${index + 1}. **${reward.guildName}** - ${date}`;
      });

      const totalGems = rewards.reduce((sum, r) => sum + r.rewardGems, 0);

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('📋 서버 초대 보상 목록')
        .setDescription(
          [
            createDivider(),
            `총 ${rewards.length}개 서버에서 보상 받음`,
            `누적 젬: ${formatNumber(totalGems)}`,
            createDivider(),
            '',
            ...rewardLines,
          ].join('\n')
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    await interaction.reply({
      content: '알 수 없는 하위 명령입니다.',
      ephemeral: true,
    });
  },

  SERVER_INVITE_REWARDS,
  grantServerInviteReward,
  getServerInviteRewards,
};
