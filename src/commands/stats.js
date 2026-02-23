const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  DEFAULTS,
  STATS_ITEM_TYPES,
  getEconomyStatistics,
} = require('../game/economy-monitor');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');

const STATS_BUTTON_PREFIX = 'stats:';

function normalizeItemType(itemType) {
  if (itemType && STATS_ITEM_TYPES[itemType]) {
    return itemType;
  }

  return STATS_ITEM_TYPES.all;
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

function formatChangeRate(changeRate) {
  if (changeRate === null || !Number.isFinite(changeRate)) {
    return '신규';
  }

  const sign = changeRate >= 0 ? '+' : '';
  return `${sign}${changeRate.toFixed(1)}%`;
}

function buildItemVolumeLines(rows, limit = 10) {
  if (!rows || rows.length === 0) {
    return ['집계 데이터 없음'];
  }

  return rows.slice(0, limit).map((entry) => (
    `${entry.rank}. ${entry.emoji || '📦'} ${entry.itemName} ${formatNumber(entry.quantity)}개 (${formatNumber(entry.totalVolume)}G)`
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

function buildDailyLines(activity, limit = 7) {
  if (!activity?.daily || activity.daily.length === 0) {
    return ['집계 데이터 없음'];
  }

  return activity.daily.slice(-limit).map((row) => (
    `${row.day}: ${formatNumber(row.tradeCount)}건 / ${formatNumber(row.volume)}G`
  ));
}

function buildTopTraderLines(rows, limit = 10) {
  if (!rows || rows.length === 0) {
    return ['집계 데이터 없음'];
  }

  return rows.slice(0, limit).map((entry) => (
    `${entry.rank}. ${entry.name} ${formatNumber(entry.tradeVolume)}G`
  ));
}

function createStatsEmbed(stats) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('📊 거래 통계 대시보드')
    .setDescription(
      [
        createDivider(),
        `조회 범주: **${formatItemTypeLabel(stats.itemType)}**`,
        `기간: 최근 ${stats.tradeActivity.days}일`,
        `총 거래수: ${formatNumber(stats.tradeActivity.totalTrades)}건`,
        `총 거래량: ${formatNumber(stats.tradeActivity.totalVolume)}G`,
        createDivider(),
      ].join('\n'),
    )
    .addFields(
      {
        name: '🔥 거래량 TOP 10 (아이템)',
        value: buildItemVolumeLines(stats.itemTradeVolumeTop10, 10).join('\n'),
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
        name: '🗓️ 일별 거래량',
        value: buildDailyLines(stats.tradeActivity, 7).join('\n'),
        inline: false,
      },
    )
    .setTimestamp();
}

function createStatsActionRow(itemType) {
  const activeType = normalizeItemType(itemType);

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${STATS_BUTTON_PREFIX}filter:${STATS_ITEM_TYPES.all}`)
      .setLabel('전체')
      .setStyle(activeType === STATS_ITEM_TYPES.all ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${STATS_BUTTON_PREFIX}filter:${STATS_ITEM_TYPES.resource}`)
      .setLabel('자원')
      .setStyle(activeType === STATS_ITEM_TYPES.resource ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${STATS_BUTTON_PREFIX}filter:${STATS_ITEM_TYPES.equipment}`)
      .setLabel('장비')
      .setStyle(activeType === STATS_ITEM_TYPES.equipment ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${STATS_BUTTON_PREFIX}refresh:${activeType}`)
      .setLabel('새로고침')
      .setStyle(ButtonStyle.Success),
  );
}

async function buildStatsPayload(prisma, itemType) {
  const normalizedItemType = normalizeItemType(itemType);
  const stats = await getEconomyStatistics(prisma, {
    limit: 10,
    activityDays: DEFAULTS.tradeActivityDays,
    itemType: normalizedItemType,
    now: new Date(),
  });

  return {
    embeds: [createStatsEmbed(stats)],
    components: [createStatsActionRow(normalizedItemType)],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('최근 거래 통계를 확인합니다')
    .addStringOption((option) => option
      .setName('item_type')
      .setDescription('조회 범주')
      .setRequired(false)
      .addChoices(
        { name: '전체', value: STATS_ITEM_TYPES.all },
        { name: '자원', value: STATS_ITEM_TYPES.resource },
        { name: '장비', value: STATS_ITEM_TYPES.equipment },
      )),

  async execute(interaction, { prisma }) {
    const itemType = interaction.options.getString('item_type') || STATS_ITEM_TYPES.all;
    await interaction.reply(await buildStatsPayload(prisma, itemType));
  },

  async handleStatsButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(STATS_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(STATS_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    if (action === 'filter') {
      await interaction.update(await buildStatsPayload(prisma, param));
      return true;
    }

    if (action === 'refresh') {
      await interaction.update(await buildStatsPayload(prisma, param || STATS_ITEM_TYPES.all));
      return true;
    }

    return false;
  },

  STATS_BUTTON_PREFIX,
};
