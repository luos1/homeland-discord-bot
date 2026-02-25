const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const {
  SNAPSHOT_TYPES,
  STATS_ITEM_TYPES,
  createEconomySnapshot,
  formatEconomyAlertLines,
  getEconomyDashboard,
  getEconomyStatistics,
  runEconomyAlertChecks,
} = require('../game/economy-monitor');
const {
  FEE_CONFIG_KEYS,
  adjustFeeRateByStep,
  formatFeePercent,
  getFeeDashboard,
  toggleFeeAutoAdjust,
} = require('../game/fee-config');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');

const MODE_DASHBOARD = 'dashboard';
const MODE_SNAPSHOT = 'snapshot';
const MODE_STATS = 'stats';
const MODE_ALERTS = 'alerts';
const MODE_FEES = 'fees';

const ECONOMY_ADMIN_BUTTON_PREFIX = 'economy_admin:';

function formatChangeRate(changeRate) {
  if (changeRate === null || !Number.isFinite(changeRate)) {
    return '신규';
  }

  const sign = changeRate >= 0 ? '+' : '';
  return `${sign}${changeRate.toFixed(1)}%`;
}

function formatItemTypeLabel(itemType) {
  if (itemType === STATS_ITEM_TYPES.resource) {
    return '자원';
  }

  if (itemType === STATS_ITEM_TYPES.equipment) {
    return '장비';
  }

  return '전체';
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

function buildTopTraderLines(rows, limit = 5) {
  if (!rows || rows.length === 0) {
    return ['집계 데이터 없음'];
  }

  return rows.slice(0, limit).map((entry) => (
    `${entry.rank}. ${entry.name} ${formatNumber(entry.tradeVolume)}G`
  ));
}

function buildTopItemLines(rows, limit = 10) {
  if (!rows || rows.length === 0) {
    return ['집계 데이터 없음'];
  }

  return rows.slice(0, limit).map((entry) => (
    `${entry.rank}. ${entry.emoji || '📦'} ${entry.itemName} ${formatNumber(entry.quantity)}개 (${formatNumber(entry.totalVolume)}G)`
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

function buildPriceChartLines(priceTrend, limit = 3) {
  if (!priceTrend?.items || priceTrend.items.length === 0) {
    return ['집계 데이터 없음'];
  }

  return priceTrend.items.slice(0, limit).map((entry, index) => {
    const from = entry.firstPrice > 0 ? `${formatNumber(entry.firstPrice)}G` : '-';
    const to = entry.lastPrice > 0 ? `${formatNumber(entry.lastPrice)}G` : '-';

    return `${index + 1}. ${entry.emoji || '📦'} ${entry.itemName}\n${entry.sparkline} ${from} → ${to} (${formatChangeRate(entry.changeRate)})`;
  });
}

function createNavigationRow(activeMode, snapshotType = SNAPSHOT_TYPES.hourly) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}view:${MODE_DASHBOARD}:${snapshotType}`)
      .setLabel('대시보드')
      .setStyle(activeMode === MODE_DASHBOARD ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}view:${MODE_STATS}`)
      .setLabel('통계')
      .setStyle(activeMode === MODE_STATS ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}view:${MODE_ALERTS}`)
      .setLabel('알림')
      .setStyle(activeMode === MODE_ALERTS ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}snapshot:${snapshotType}`)
      .setLabel('스냅샷')
      .setStyle(activeMode === MODE_SNAPSHOT ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}view:${MODE_FEES}`)
      .setLabel('수수료')
      .setStyle(activeMode === MODE_FEES ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

function createDashboardEmbed({ dashboard, stats, alerts, snapshotType, feeDashboard }) {
  const titleSnapshot = snapshotType === SNAPSHOT_TYPES.daily ? '일별' : '시간별';
  const marketFee = feeDashboard.configs[FEE_CONFIG_KEYS.market];
  const gemFee = feeDashboard.configs[FEE_CONFIG_KEYS.gem];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(`📈 경제 대시보드 (${titleSnapshot})`)
    .setDescription(
      [
        createDivider(),
        `💰 골드 총 유통량: **${formatNumber(dashboard.totalGold)}G**`,
        `📊 거래소 거래량(24h): **${formatNumber(dashboard.tradeVolume.last24h)}G**`,
        `🧾 거래 건수(24h): **${formatNumber(dashboard.tradeVolume.tradeCount24h)}건**`,
        `💸 수수료(시장/젬): **${formatFeePercent(marketFee.currentRate)} / ${formatFeePercent(gemFee.currentRate)}**`,
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
        name: '🔥 아이템 거래량 TOP 5 (7일)',
        value: buildTopItemLines(stats.itemTradeVolumeTop10, 5).join('\n'),
        inline: false,
      },
      {
        name: '🏆 유저 거래량 TOP 5',
        value: buildTopTraderLines(stats.tradeVolumeTop10, 5).join('\n'),
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
    `조회 범주: ${formatItemTypeLabel(stats.itemType)}`,
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
    .setTitle('📊 거래 통계 대시보드')
    .setDescription(
      [
        createDivider(),
        ...activityLines,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '🔥 거래량 TOP 10 (아이템)',
        value: buildTopItemLines(stats.itemTradeVolumeTop10, 10).join('\n'),
        inline: false,
      },
      {
        name: '📈 가격 추이 차트 (7일)',
        value: buildPriceChartLines(stats.priceTrend7d, 3).join('\n\n'),
        inline: false,
      },
      {
        name: '🏆 거래량 TOP 10 (유저)',
        value: buildTopTraderLines(stats.tradeVolumeTop10, 10).join('\n'),
        inline: false,
      },
      {
        name: '👑 부자 순위 TOP 10',
        value: buildRichestLines(stats.richestRanking, 10).join('\n'),
        inline: false,
      },
      {
        name: '🗓️ 거래 활성도 (일별)',
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

function buildFeeField(config) {
  return [
    `현재: **${formatFeePercent(config.currentRate)}**`,
    `기본/중간/최소/최대: ${formatFeePercent(config.baseRate)} / ${formatFeePercent(config.midRate)} / ${formatFeePercent(config.minRate)} / ${formatFeePercent(config.maxRate)}`,
    `자동 조정: ${config.autoAdjust ? 'ON' : 'OFF'}`,
    `최근 조정자: ${config.adjustedBy || 'N/A'}`,
  ].join('\n');
}

function createFeeEmbed(feeDashboard) {
  const market = feeDashboard.configs[FEE_CONFIG_KEYS.market];
  const gem = feeDashboard.configs[FEE_CONFIG_KEYS.gem];
  const auction = feeDashboard.configs[FEE_CONFIG_KEYS.auction];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('⚙️ 수수료 관리')
    .setDescription(
      [
        createDivider(),
        `24h 거래량: **${formatNumber(feeDashboard.dailyTradeVolume)}G**`,
        `자동 조정 기준: ${formatNumber(feeDashboard.thresholdLow)}G ~ ${formatNumber(feeDashboard.thresholdHigh)}G`,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '🏪 거래소 수수료',
        value: buildFeeField(market),
        inline: false,
      },
      {
        name: '💠 젬 교환 수수료',
        value: buildFeeField(gem),
        inline: false,
      },
      {
        name: '🔨 경매 수수료 (예비)',
        value: buildFeeField(auction),
        inline: false,
      },
    )
    .setTimestamp();
}

function createFeeActionRows(feeDashboard) {
  const market = feeDashboard.configs[FEE_CONFIG_KEYS.market];
  const gem = feeDashboard.configs[FEE_CONFIG_KEYS.gem];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:refresh`)
        .setLabel('새로고침')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:toggle_auto:${FEE_CONFIG_KEYS.market}`)
        .setLabel(`거래소 자동 ${market.autoAdjust ? 'ON' : 'OFF'}`)
        .setStyle(market.autoAdjust ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:toggle_auto:${FEE_CONFIG_KEYS.gem}`)
        .setLabel(`젬 자동 ${gem.autoAdjust ? 'ON' : 'OFF'}`)
        .setStyle(gem.autoAdjust ? ButtonStyle.Success : ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:delta:${FEE_CONFIG_KEYS.market}:-0.01`)
        .setLabel('거래소 -1.0%')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:delta:${FEE_CONFIG_KEYS.market}:0.01`)
        .setLabel('거래소 +1.0%')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:delta:${FEE_CONFIG_KEYS.gem}:-0.005`)
        .setLabel('젬 -0.5%')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${ECONOMY_ADMIN_BUTTON_PREFIX}fee:delta:${FEE_CONFIG_KEYS.gem}:0.005`)
        .setLabel('젬 +0.5%')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

async function buildDashboardPayload(prisma, snapshotType) {
  const now = new Date();
  const [dashboard, stats, alertResult, feeDashboard] = await Promise.all([
    getEconomyDashboard(prisma, {
      snapshotType,
      createIfMissing: true,
      now,
    }),
    getEconomyStatistics(prisma, {
      limit: 10,
      activityDays: 7,
      itemType: STATS_ITEM_TYPES.all,
      now,
    }),
    runEconomyAlertChecks(prisma, {
      snapshotType: SNAPSHOT_TYPES.hourly,
      persist: false,
    }),
    getFeeDashboard(prisma, { now }),
  ]);

  return {
    embeds: [
      createDashboardEmbed({
        dashboard,
        stats,
        alerts: alertResult.alerts,
        snapshotType,
        feeDashboard,
      }),
    ],
    components: [createNavigationRow(MODE_DASHBOARD, snapshotType)],
  };
}

async function buildStatsPayload(prisma, itemType = STATS_ITEM_TYPES.all, snapshotType = SNAPSHOT_TYPES.hourly) {
  const stats = await getEconomyStatistics(prisma, {
    limit: 10,
    activityDays: 7,
    itemType,
    now: new Date(),
  });

  return {
    embeds: [createStatsEmbed(stats)],
    components: [createNavigationRow(MODE_STATS, snapshotType)],
  };
}

async function buildAlertsPayload(prisma, snapshotType = SNAPSHOT_TYPES.hourly) {
  const alertResult = await runEconomyAlertChecks(prisma, {
    snapshotType: SNAPSHOT_TYPES.hourly,
    persist: true,
  });

  return {
    embeds: [createAlertEmbed(alertResult)],
    components: [createNavigationRow(MODE_ALERTS, snapshotType)],
  };
}

async function buildSnapshotPayload(prisma, snapshotType = SNAPSHOT_TYPES.hourly) {
  const snapshot = await createEconomySnapshot(prisma, {
    snapshotType,
    timestamp: new Date(),
  });

  return {
    embeds: [createSnapshotEmbed(snapshot)],
    components: [createNavigationRow(MODE_SNAPSHOT, snapshotType)],
  };
}

async function buildFeePayload(prisma, snapshotType = SNAPSHOT_TYPES.hourly) {
  const feeDashboard = await getFeeDashboard(prisma, {
    now: new Date(),
  });

  return {
    embeds: [createFeeEmbed(feeDashboard)],
    components: [
      createNavigationRow(MODE_FEES, snapshotType),
      ...createFeeActionRows(feeDashboard),
    ],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy_admin')
		.setNameLocalizations({ "en-US": "economy-admin" })
    .setDescription('[관리자] 경제 모니터링/수수료 관리 대시보드')
		.setDescriptionLocalizations({ "en-US": "Manage [관리자] 경제 모니터링/수수료 관리 대시보드" })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option
      .setName('mode')
      .setDescription('조회 모드')
      .setRequired(false)
      .addChoices(
        { name: '대시보드', value: MODE_DASHBOARD },
        { name: '스냅샷 생성', value: MODE_SNAPSHOT },
        { name: '거래 통계', value: MODE_STATS },
        { name: '알림 점검', value: MODE_ALERTS },
        { name: '수수료 관리', value: MODE_FEES },
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
      await interaction.editReply(await buildSnapshotPayload(prisma, snapshotType));
      return;
    }

    if (mode === MODE_STATS) {
      await interaction.editReply(await buildStatsPayload(prisma, STATS_ITEM_TYPES.all, snapshotType));
      return;
    }

    if (mode === MODE_ALERTS) {
      await interaction.editReply(await buildAlertsPayload(prisma, snapshotType));
      return;
    }

    if (mode === MODE_FEES) {
      await interaction.editReply(await buildFeePayload(prisma, snapshotType));
      return;
    }

    await interaction.editReply(await buildDashboardPayload(prisma, snapshotType));
  },

  async handleEconomyAdminButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(ECONOMY_ADMIN_BUTTON_PREFIX)) {
      return false;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ 이 버튼은 관리자만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return true;
    }

    const customId = interaction.customId.slice(ECONOMY_ADMIN_BUTTON_PREFIX.length);
    const [action, param1, param2, param3] = customId.split(':');

    if (action === 'view') {
      if (param1 === MODE_DASHBOARD) {
        const snapshotType = param2 || SNAPSHOT_TYPES.hourly;
        await interaction.update(await buildDashboardPayload(prisma, snapshotType));
        return true;
      }

      if (param1 === MODE_STATS) {
        await interaction.update(await buildStatsPayload(prisma, STATS_ITEM_TYPES.all));
        return true;
      }

      if (param1 === MODE_ALERTS) {
        await interaction.update(await buildAlertsPayload(prisma));
        return true;
      }

      if (param1 === MODE_FEES) {
        await interaction.update(await buildFeePayload(prisma));
        return true;
      }

      return false;
    }

    if (action === 'snapshot') {
      const snapshotType = param1 || SNAPSHOT_TYPES.hourly;
      await interaction.update(await buildSnapshotPayload(prisma, snapshotType));
      return true;
    }

    if (action === 'fee') {
      if (param1 === 'refresh') {
        await interaction.update(await buildFeePayload(prisma));
        return true;
      }

      if (param1 === 'toggle_auto') {
        const configKey = param2;

        if (!configKey) {
          await interaction.reply({
            content: '❌ 잘못된 수수료 키입니다.',
            ephemeral: true,
          });
          return true;
        }

        await toggleFeeAutoAdjust(prisma, configKey, {
          adjustedBy: interaction.user.id,
          now: new Date(),
        });

        await interaction.update(await buildFeePayload(prisma));
        return true;
      }

      if (param1 === 'delta') {
        const configKey = param2;
        const deltaRate = Number(param3);

        if (!configKey || !Number.isFinite(deltaRate)) {
          await interaction.reply({
            content: '❌ 잘못된 수수료 조정 요청입니다.',
            ephemeral: true,
          });
          return true;
        }

        await adjustFeeRateByStep(prisma, configKey, {
          deltaRate,
          adjustedBy: interaction.user.id,
          now: new Date(),
        });

        await interaction.update(await buildFeePayload(prisma));
        return true;
      }

      return false;
    }

    return false;
  },

  ECONOMY_ADMIN_BUTTON_PREFIX,
};
