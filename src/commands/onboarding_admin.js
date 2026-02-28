const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const { getOnboardingConversionMetrics } = require('../game/onboarding-metrics');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');

function createOnboardingMetricsEmbed(metrics) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('📊 온보딩/보상 운영 메트릭')
    .setDescription(
      [
        createDivider(),
        `🆕 신규 가입(최근 24h): **${formatNumber(metrics.newUsers24h)}명**`,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '🎯 온보딩 퀘스트 완료(누적)',
        value: [
          `1단계(캐릭터 생성): ${formatNumber(metrics.onboardingQuestCompleted.quest1)}명`,
          `2단계(첫 전투): ${formatNumber(metrics.onboardingQuestCompleted.quest2)}명`,
          `3단계(선물 보내기): ${formatNumber(metrics.onboardingQuestCompleted.quest3)}명`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '📅 7일 출석 달성(누적)',
        value: `${formatNumber(metrics.attendance7dAchieved)}명`,
        inline: true,
      },
      {
        name: '🎁 초대 보상 수령(누적)',
        value: `${formatNumber(metrics.inviteRewardClaimed)}건`,
        inline: true,
      },
    )
    .setFooter({ text: '운영자 전용 메트릭' })
    .setTimestamp(metrics.measuredAt);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding_admin')
    .setNameLocalizations({ 'en-US': 'onboarding-admin' })
    .setDescription('[관리자] 온보딩/보상 전환 메트릭 조회')
    .setDescriptionLocalizations({ 'en-US': 'Manage [관리자] 온보딩/보상 전환 메트릭 조회' })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { prisma }) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const metrics = await getOnboardingConversionMetrics(prisma, {
      now: new Date(),
    });

    await interaction.editReply({
      embeds: [createOnboardingMetricsEmbed(metrics)],
    });
  },

  createOnboardingMetricsEmbed,
};
