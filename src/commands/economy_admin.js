const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

const {
  SNAPSHOT_TYPES,
  createEconomySnapshot,
  formatEconomyAlertLines,
  getEconomyDashboard,
  getEconomyStatistics,
  runEconomyAlertChecks,
} = require('../game/economy-monitor');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');

const MODE_DASHBOARD = 'dashboard';
const MODE_SNAPSHOT = 'snapshot';
const MODE_STATS = 'stats';
const MODE_ALERTS = 'alerts';

function formatChangeRate(changeRate) {
  if (changeRate === null || !Number.isFinite(changeRate)) {
    return '신규';
  }

  const sign = changeRate >= 0 ? '+' : '';
  return `${sign}${changeRate.toFixed(1)}%`;
}

function buildResourceLines(resources, limit = 8) {
  if (!resources || resources.length === 0) {
    return ['집계 데이터 없음'];
  }

  return resources.slice(0, limit).map((resource, index) => (
    `${index + 1}. ${resource.emoji || '📦'} ${resource.name} ${formatNumber(resource.quantity)}개`
  ));
}

function buildPriceTrendLines(trends, limit = 8) {
  if (!trends || trends.length === 0) {
    return ['집계 데이터 없음'];
  }

  return trends.slice(0, limit).map((entry, index) => (
    `${index + 1}. ${entry.resourceName} ${formatNumber(entry.currentPrice)}G (${formatChangeRate(entry.changeRate)})`
  ));
}

function buildTopTradeLines(rows, limit = 5) {
  if (!rows || rows.length === 0) {
    return ['집계 데이터 없음'];
  }

  return rows.slice(0, limit).map((entry) => (
    `${entry.rank}. ${entry.name} ${formatNumber(entry.tradeVolume)}G`
  ));
}

function buildRichestLines(rows, limit = 5) {
  if (!rows || rows.length === 0) {
    return ['집계 데이터 없음'];
  }

  return rows.slice(0, limit).map((entry) => (
    `${entry.rank}. ${entry.name} ${formatNumber(entry.gold)}G`
  ));
}

function createDashboardEmbed({ dashboard, stats, alerts, snapshotType }) {
  const titleSnapshot = snapshotType === SNAPSHOT_TYPES.daily ? '일별' : '시간별';

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(`📈 경제 대시보드 (${titleSnapshot})`)
    .setDescription(
      [
        createDivider(),
        `💰 골드 총 유통량: **${formatNumber(dashboard.totalGold)}G**`,
        `📊 거래소 거래량(24h): **${formatNumber(dashboard.tradeVolume.last24h)}G**`,
        `🧾 거래 건수(24h): **${formatNumber(dashboard.tradeVolume.tradeCount24h)}건**`,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '🪙 자원별 유통량',
        value: buildResourceLines(dashboard.resourceCirculation).join('\n'),
        inline: false,
      },
      {
        name: '📉 평균 가격 추이',
        value: buildPriceTrendLines(dashboard.averagePriceTrend).join('\n'),
        inline: false,
      },
      {
        name: '🏆 거래량 TOP 5',
        value: buildTopTradeLines(stats.tradeVolumeTop10, 5).join('\n'),
        inline: true,
      },
      {
        name: '👑 부자 순위 TOP 5',
        value: buildRichestLines(stats.richestRanking, 5).join('\n'),
        inline: true,
      },
      {
        name: '🚨 감지된 이상 징후',
        value: formatEconomyAlertLines(alerts, { maxLines: 5 }).join('\n'),
        inline: false,
      },
    )
    .setFooter({
      text: '경제 모니터링 시스템',
    })
    .setTimestamp();
}

function createSnapshotEmbed(snapshot) {
  const resources = Object.values(snapshot.resources || {});
  const prices = Object.values(snapshot.averagePrices || {});

  const resourceLines = resources.length > 0
    ? resources
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)
      .map((row, index) => `${index + 1}. ${row.emoji || '📦'} ${row.name} ${formatNumber(row.quantity)}개`)
    : ['집계 데이터 없음'];
  const priceLines = prices.length > 0
    ? prices
      .sort((a, b) => b.averagePrice - a.averagePrice)
      .slice(0, 8)
      .map((row, index) => `${index + 1}. ${row.resourceName} ${formatNumber(row.averagePrice)}G`)
    : ['집계 데이터 없음'];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('🧾 EconomySnapshot 생성 완료')
    .setDescription(
      [
        createDivider(),
        `타입: **${snapshot.snapshotType}**`,
        `스냅샷 ID: **#${snapshot.id}**`,
        `총 골드: **${formatNumber(snapshot.totalGold)}G**`,
        `총 거래량: **${formatNumber(snapshot.totalTradeVolume)}G**`,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '자원별 유통량',
        value: resourceLines.join('\n'),
        inline: false,
      },
      {
        name: '평균 가격(최근 집계)',
        value: priceLines.join('\n'),
        inline: false,
      },
    )
    .setTimestamp();
}

function createStatsEmbed(stats) {
  const activityLines = [
    `기간: 최근 ${stats.tradeActivity.days}일`,
    `총 거래수: ${formatNumber(stats.tradeActivity.totalTrades)}건`,
    `총 거래량: ${formatNumber(stats.tradeActivity.totalVolume)}G`,
  ];

  const dailyLines = stats.tradeActivity.daily.length > 0
    ? stats.tradeActivity.daily
      .slice(-7)
      .map((row) => `${row.day}: ${formatNumber(row.tradeCount)}건 / ${formatNumber(row.volume)}G`)
    : ['집계 데이터 없음'];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('📊 통계 API 결과')
    .setDescription(
      [
        createDivider(),
        ...activityLines,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '거래량 TOP 10',
        value: buildTopTradeLines(stats.tradeVolumeTop10, 10).join('\n'),
        inline: false,
      },
      {
        name: '부자 순위 TOP 10',
        value: buildRichestLines(stats.richestRanking, 10).join('\n'),
        inline: false,
      },
      {
        name: '거래 활성도(일별)',
        value: dailyLines.join('\n'),
        inline: false,
      },
    )
    .setTimestamp();
}

function createAlertEmbed(alertResult) {
  return new EmbedBuilder()
    .setColor(alertResult.alerts.length > 0 ? EMBED_COLORS.warning : EMBED_COLORS.profile)
    .setTitle('🚨 경제 알림 점검 결과')
    .setDescription(
      [
        createDivider(),
        `인플레이션 감지: **${alertResult.inflationAlerts.length}건**`,
        `비정상 거래 감지: **${alertResult.abnormalTradeAlerts.length}건**`,
        `총 알림: **${alertResult.alerts.length}건**`,
        createDivider(),
      ].join('\n'),
    )
    .addFields({
      name: '알림 상세',
      value: formatEconomyAlertLines(alertResult.alerts, { maxLines: 15 }).join('\n'),
      inline: false,
    })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy_admin')
    .setDescription('[관리자] 경제 모니터링 대시보드')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option
      .setName('mode')
      .setDescription('조회 모드')
      .setRequired(false)
      .addChoices(
        { name: '대시보드', value: MODE_DASHBOARD },
        { name: '스냅샷 생성', value: MODE_SNAPSHOT },
        { name: '통계 API', value: MODE_STATS },
        { name: '알림 점검', value: MODE_ALERTS },
      ))
    .addStringOption((option) => option
      .setName('snapshot_type')
      .setDescription('스냅샷 타입 (dashboard/snapshot 모드에서 사용)')
      .setRequired(false)
      .addChoices(
        { name: '시간별', value: SNAPSHOT_TYPES.hourly },
        { name: '일별', value: SNAPSHOT_TYPES.daily },
        { name: '수동', value: SNAPSHOT_TYPES.manual },
      )),

  async execute(interaction, { prisma }) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({
      ephemeral: true,
    });

    const mode = interaction.options.getString('mode') || MODE_DASHBOARD;
    const snapshotType = interaction.options.getString('snapshot_type') || SNAPSHOT_TYPES.hourly;

    if (mode === MODE_SNAPSHOT) {
      const snapshot = await createEconomySnapshot(prisma, {
        snapshotType,
        timestamp: new Date(),
      });

      await interaction.editReply({
        embeds: [createSnapshotEmbed(snapshot)],
      });
      return;
    }

    if (mode === MODE_STATS) {
      const stats = await getEconomyStatistics(prisma, {
        limit: 10,
        activityDays: 7,
        now: new Date(),
      });

      await interaction.editReply({
        embeds: [createStatsEmbed(stats)],
      });
      return;
    }

    if (mode === MODE_ALERTS) {
      const alertResult = await runEconomyAlertChecks(prisma, {
        snapshotType: SNAPSHOT_TYPES.hourly,
        persist: true,
      });

      await interaction.editReply({
        embeds: [createAlertEmbed(alertResult)],
      });
      return;
    }

    const [dashboard, stats, alertResult] = await Promise.all([
      getEconomyDashboard(prisma, {
        snapshotType,
        createIfMissing: true,
        now: new Date(),
      }),
      getEconomyStatistics(prisma, {
        limit: 10,
        activityDays: 7,
        now: new Date(),
      }),
      runEconomyAlertChecks(prisma, {
        snapshotType: SNAPSHOT_TYPES.hourly,
        persist: false,
      }),
    ]);

    await interaction.editReply({
      embeds: [
        createDashboardEmbed({
          dashboard,
          stats,
          alerts: alertResult.alerts,
          snapshotType,
        }),
      ],
    });
  },
};
