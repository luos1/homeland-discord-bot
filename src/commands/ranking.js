const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { createVillageNavigationRow, VILLAGE_MENU_KEYS } = require('../utils/village');

const RANKING_COMPONENT_PREFIX = 'ranking:';
const RANKING_CACHE_TTL_MS = 60 * 1000;
const RANKING_TOP_LIMIT = 10;

const RANKING_PERIODS = {
  weekly: {
    key: 'weekly',
    label: '주간',
    days: 7,
  },
  monthly: {
    key: 'monthly',
    label: '월간',
    days: 30,
  },
  all: {
    key: 'all',
    label: '전체',
    days: null,
  },
};

const RANKING_CATEGORIES = {
  level: {
    key: 'level',
    emoji: '📈',
    menuLabel: '레벨 랭킹',
    description: '가장 높은 레벨 순위',
    field: 'level',
    type: 'snapshot',
    formatValue: (value) => `Lv.${formatNumber(value)}`,
  },
  battle_wins: {
    key: 'battle_wins',
    emoji: '⚔️',
    menuLabel: '전투 승수 랭킹',
    description: '누적 전투 승리 횟수',
    field: 'battleWins',
    eventCategory: 'battle_wins',
    type: 'event',
    formatValue: (value) => `${formatNumber(value)}승`,
  },
  boss_kills: {
    key: 'boss_kills',
    emoji: '🐉',
    menuLabel: '보스 처치 수',
    description: '누적 보스 처치 횟수',
    field: 'bossKills',
    eventCategory: 'boss_kills',
    type: 'event',
    formatValue: (value) => `${formatNumber(value)}회`,
  },
  gold: {
    key: 'gold',
    emoji: '💰',
    menuLabel: '보유 골드',
    description: '현재 보유 골드 순위',
    field: 'gold',
    type: 'snapshot',
    formatValue: (value) => `${formatNumber(value)}G`,
  },
  production_level: {
    key: 'production_level',
    emoji: '🔨',
    menuLabel: '생산 레벨',
    description: '생산 레벨 순위',
    field: 'productionLevel',
    type: 'snapshot',
    formatValue: (value) => `Lv.${formatNumber(value)}`,
  },
  trade_volume: {
    key: 'trade_volume',
    emoji: '📊',
    menuLabel: '거래 총액',
    description: '누적 거래 금액 순위',
    field: 'tradeVolume',
    eventCategory: 'trade_volume',
    type: 'event',
    formatValue: (value) => `${formatNumber(value)}G`,
  },
};

const RANKING_PERIOD_ORDER = ['weekly', 'monthly', 'all'];
const RANKING_CATEGORY_ORDER = [
  'level',
  'battle_wins',
  'boss_kills',
  'gold',
  'production_level',
  'trade_volume',
];

const rankingCache = new Map();
const previousRanksByKey = new Map();

function getCacheKey(categoryKey, periodKey) {
  return `${categoryKey}:${periodKey}`;
}

function isValidPeriod(periodKey) {
  return Boolean(RANKING_PERIODS[periodKey]);
}

function isValidCategory(categoryKey) {
  return Boolean(RANKING_CATEGORIES[categoryKey]);
}

function getPeriodStart(periodKey) {
  const period = RANKING_PERIODS[periodKey];

  if (!period || period.days === null) {
    return null;
  }

  const start = new Date();
  start.setMilliseconds(0);
  start.setSeconds(0);
  start.setMinutes(0);
  start.setHours(0);
  start.setDate(start.getDate() - period.days);
  return start;
}

function formatTrend(previousRank, currentRank) {
  if (!previousRank) {
    return '→';
  }

  if (currentRank < previousRank) {
    return `↑${previousRank - currentRank}`;
  }

  if (currentRank > previousRank) {
    return `↓${currentRank - previousRank}`;
  }

  return '→';
}

function getMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}위`;
}

function buildCategorySelectCustomId(periodKey) {
  return `${RANKING_COMPONENT_PREFIX}category:${periodKey}`;
}

function buildPeriodButtonCustomId(periodKey, categoryKey) {
  return `${RANKING_COMPONENT_PREFIX}period:${periodKey}:${categoryKey}`;
}

function buildRefreshButtonCustomId(periodKey, categoryKey) {
  return `${RANKING_COMPONENT_PREFIX}refresh:${periodKey}:${categoryKey}`;
}

function createRankingComponents({ categoryKey, periodKey }) {
  const categoryOptions = RANKING_CATEGORY_ORDER.map((key) => {
    const category = RANKING_CATEGORIES[key];
    return {
      label: category.menuLabel,
      description: category.description,
      value: category.key,
      emoji: category.emoji,
      default: category.key === categoryKey,
    };
  });

  const categoryRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(buildCategorySelectCustomId(periodKey))
      .setPlaceholder('랭킹 카테고리를 선택하세요')
      .addOptions(categoryOptions),
  );

  const periodButtons = RANKING_PERIOD_ORDER.map((key) => {
    const period = RANKING_PERIODS[key];
    return new ButtonBuilder()
      .setCustomId(buildPeriodButtonCustomId(period.key, categoryKey))
      .setLabel(period.label)
      .setStyle(period.key === periodKey ? ButtonStyle.Primary : ButtonStyle.Secondary);
  });

  const refreshButton = new ButtonBuilder()
    .setCustomId(buildRefreshButtonCustomId(periodKey, categoryKey))
    .setLabel('새로고침')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Success);

  const periodRow = new ActionRowBuilder().addComponents(...periodButtons, refreshButton);

  return [
    categoryRow,
    periodRow,
    createVillageNavigationRow({ backTo: VILLAGE_MENU_KEYS.ranking }),
  ];
}

async function fetchSnapshotRanking(prisma, category, periodKey) {
  const where = {};
  const periodStart = getPeriodStart(periodKey);

  if (periodStart) {
    where.updatedAt = { gte: periodStart };
  }

  const select = {
    id: true,
    name: true,
  };

  select[category.field] = true;

  const characters = await prisma.character.findMany({
    where,
    select,
    orderBy: [{ [category.field]: 'desc' }, { id: 'asc' }],
  });

  return characters.map((character) => ({
    characterId: character.id,
    name: character.name,
    value: character[category.field] || 0,
  }));
}

async function fetchPeriodEventRanking(prisma, category, periodKey) {
  const periodStart = getPeriodStart(periodKey);

  if (!periodStart) {
    return [];
  }

  const grouped = await prisma.rankingEvent.groupBy({
    by: ['characterId'],
    where: {
      category: category.eventCategory,
      createdAt: {
        gte: periodStart,
      },
    },
    _sum: {
      value: true,
    },
  });

  const rows = grouped
    .map((row) => ({
      characterId: row.characterId,
      value: row._sum.value || 0,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.characterId - b.characterId);

  if (rows.length === 0) {
    return [];
  }

  const characters = await prisma.character.findMany({
    where: {
      id: {
        in: rows.map((row) => row.characterId),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const nameById = new Map(characters.map((character) => [character.id, character.name]));

  return rows.map((row) => ({
    characterId: row.characterId,
    name: nameById.get(row.characterId) || `캐릭터 #${row.characterId}`,
    value: row.value,
  }));
}

async function fetchRankingEntries(prisma, category, periodKey) {
  if (category.type === 'event' && periodKey !== 'all') {
    return fetchPeriodEventRanking(prisma, category, periodKey);
  }

  return fetchSnapshotRanking(prisma, category, periodKey);
}

function buildRankedEntries(entries, previousRanks) {
  return entries.map((entry, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(entry.characterId);

    return {
      ...entry,
      rank,
      trend: formatTrend(previousRank, rank),
    };
  });
}

async function buildRankingSnapshot(prisma, categoryKey, periodKey) {
  const category = RANKING_CATEGORIES[categoryKey];
  const cacheKey = getCacheKey(categoryKey, periodKey);
  const previousRanks = previousRanksByKey.get(cacheKey) || new Map();

  const entries = await fetchRankingEntries(prisma, category, periodKey);
  const rankedEntries = buildRankedEntries(entries, previousRanks);
  const rankByCharacterId = new Map();

  rankedEntries.forEach((entry) => {
    rankByCharacterId.set(entry.characterId, entry);
  });

  const latestRanks = new Map(rankedEntries.map((entry) => [entry.characterId, entry.rank]));
  previousRanksByKey.set(cacheKey, latestRanks);

  return {
    entries: rankedEntries,
    rankByCharacterId,
    generatedAt: new Date(),
  };
}

async function getRankingSnapshot(prisma, categoryKey, periodKey) {
  const cacheKey = getCacheKey(categoryKey, periodKey);
  const now = Date.now();
  const cached = rankingCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.snapshot;
  }

  const snapshot = await buildRankingSnapshot(prisma, categoryKey, periodKey);

  rankingCache.set(cacheKey, {
    expiresAt: now + RANKING_CACHE_TTL_MS,
    snapshot,
  });

  return snapshot;
}

async function getUserCharacterForRanking(prisma, userId) {
  return prisma.character.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      level: true,
      battleWins: true,
      bossKills: true,
      gold: true,
      productionLevel: true,
      tradeVolume: true,
    },
  });
}

function buildTopRankingLines(entries, category) {
  const topEntries = entries.slice(0, RANKING_TOP_LIMIT);

  if (topEntries.length === 0) {
    return ['집계 데이터가 없습니다.'];
  }

  return topEntries.map((entry) => {
    const prefix = getMedal(entry.rank);
    const valueText = category.formatValue(entry.value);
    return `${prefix} **${entry.name}** · ${valueText} ${entry.trend}`;
  });
}

function buildMyRankText({ userCharacter, userRankEntry, category, periodKey }) {
  if (!userCharacter) {
    return '캐릭터가 없습니다. `/create`로 캐릭터를 먼저 생성하세요.';
  }

  if (userRankEntry) {
    return [
      `#${userRankEntry.rank}위`,
      `${category.formatValue(userRankEntry.value)}`,
      `${userRankEntry.trend}`,
    ].join(' | ');
  }

  const currentValue = userCharacter[category.field] || 0;
  const valueText = category.formatValue(currentValue);

  if (category.type === 'event' && periodKey !== 'all') {
    return `집계 기간 기록 없음 (${valueText})`;
  }

  if (category.type === 'snapshot' && periodKey !== 'all') {
    return `집계 기간 활동 없음 (${valueText})`;
  }

  return `순위 집계 불가 (${valueText})`;
}

function createRankingEmbed({ categoryKey, periodKey, snapshot, userCharacter }) {
  const category = RANKING_CATEGORIES[categoryKey];
  const period = RANKING_PERIODS[periodKey];
  const topLines = buildTopRankingLines(snapshot.entries, category);
  const userRankEntry = userCharacter
    ? snapshot.rankByCharacterId.get(userCharacter.id) || null
    : null;
  const myRankText = buildMyRankText({
    userCharacter,
    userRankEntry,
    category,
    periodKey,
  });

  const generatedTime = snapshot.generatedAt.toLocaleTimeString('ko-KR', {
    hour12: false,
  });

  const description = [
    createDivider(),
    `**Top ${RANKING_TOP_LIMIT}**`,
    '',
    ...topLines,
    '',
    createDivider(),
    `🕒 최근 갱신: ${generatedTime} (캐시 1분)`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`${category.emoji} ${category.menuLabel} (${period.label})`)
    .setDescription(description)
    .addFields({
      name: '내 순위',
      value: myRankText,
      inline: false,
    })
    .setFooter({
      text: '순위 변동: ↑ 상승 · ↓ 하락 · → 유지',
    });
}

async function sendRanking(interaction, { prisma, categoryKey, periodKey, mode }) {
  const [snapshot, userCharacter] = await Promise.all([
    getRankingSnapshot(prisma, categoryKey, periodKey),
    getUserCharacterForRanking(prisma, interaction.user.id),
  ]);

  const embed = createRankingEmbed({
    categoryKey,
    periodKey,
    snapshot,
    userCharacter,
  });

  const components = createRankingComponents({ categoryKey, periodKey });

  if (mode === 'update') {
    await interaction.update({
      embeds: [embed],
      components,
    });
    return;
  }

  await interaction.reply({
    embeds: [embed],
    components,
  });
}

function parseRankingCustomId(customId) {
  if (!customId || !customId.startsWith(RANKING_COMPONENT_PREFIX)) {
    return null;
  }

  const payload = customId.slice(RANKING_COMPONENT_PREFIX.length);
  const parts = payload.split(':');
  const action = parts[0];

  if (action === 'category' && parts.length === 2) {
    return {
      action,
      periodKey: parts[1],
      categoryKey: null,
    };
  }

  if ((action === 'period' || action === 'refresh') && parts.length === 3) {
    return {
      action,
      periodKey: parts[1],
      categoryKey: parts[2],
    };
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('다중 카테고리 랭킹을 확인합니다'),

  async execute(interaction, { prisma }) {
    await sendRanking(interaction, {
      prisma,
      categoryKey: 'level',
      periodKey: 'all',
      mode: 'reply',
    });
  },

  async handleRankingButton(interaction, { prisma }) {
    const parsed = parseRankingCustomId(interaction.customId);

    if (!parsed || (parsed.action !== 'period' && parsed.action !== 'refresh')) {
      return false;
    }

    if (!isValidPeriod(parsed.periodKey) || !isValidCategory(parsed.categoryKey)) {
      await interaction.reply({
        content: '유효하지 않은 랭킹 요청입니다.',
        ephemeral: true,
      });
      return true;
    }

    await sendRanking(interaction, {
      prisma,
      categoryKey: parsed.categoryKey,
      periodKey: parsed.periodKey,
      mode: 'update',
    });

    return true;
  },

  async handleRankingSelect(interaction, { prisma }) {
    const parsed = parseRankingCustomId(interaction.customId);

    if (!parsed || parsed.action !== 'category') {
      return false;
    }

    const selectedCategory = interaction.values?.[0];

    if (!selectedCategory || !isValidCategory(selectedCategory) || !isValidPeriod(parsed.periodKey)) {
      await interaction.reply({
        content: '유효하지 않은 랭킹 카테고리입니다.',
        ephemeral: true,
      });
      return true;
    }

    await sendRanking(interaction, {
      prisma,
      categoryKey: selectedCategory,
      periodKey: parsed.periodKey,
      mode: 'update',
    });

    return true;
  },

  RANKING_COMPONENT_PREFIX,
};
