const { RESOURCES } = require('./production-classes');
const { getResourceBasePrice } = require('./economy');

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;
const DEFAULT_RECENT_TRADE_LIMIT = 10;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toSafePositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toAverageUnitPrice(totalPrice, totalQuantity, fallback = 0) {
  if (!Number.isFinite(totalPrice) || !Number.isFinite(totalQuantity) || totalQuantity <= 0) {
    return fallback;
  }

  return Math.max(1, Math.round(totalPrice / totalQuantity));
}

function toResourceName(itemKey) {
  return RESOURCES[itemKey]?.name || itemKey;
}

function toResourceEmoji(itemKey) {
  return RESOURCES[itemKey]?.emoji || '📦';
}

function toTrendDirection(rate) {
  if (!Number.isFinite(rate)) {
    return 'stable';
  }

  if (rate > 0.05) {
    return 'up';
  }

  if (rate < -0.05) {
    return 'down';
  }

  return 'stable';
}

function calculateConfidence({
  tradeCount7d = 0,
  tradeCount24h = 0,
  recentCount = 0,
  totalQuantity7d = 0,
  totalQuantity24h = 0,
} = {}) {
  const countScore = clamp((tradeCount7d / 40) * 0.45 + (tradeCount24h / 12) * 0.35 + (recentCount / 10) * 0.2, 0, 1);
  const volumeScore = clamp((totalQuantity7d / 1200) * 0.5 + (totalQuantity24h / 300) * 0.5, 0, 1);
  const mixedScore = countScore * 0.7 + volumeScore * 0.3;

  return Math.round(20 + mixedScore * 75);
}

function resolveRecommendedPrice({ avg7d, avg24h, recentAvg, basePrice }) {
  const safeBasePrice = Math.max(1, toSafePositiveNumber(basePrice, 1));
  const safeAvg7d = toSafePositiveNumber(avg7d, 0);
  const safeAvg24h = toSafePositiveNumber(avg24h, 0);
  const safeRecentAvg = toSafePositiveNumber(recentAvg, 0);

  const anchorPrice = safeAvg24h || safeAvg7d || safeRecentAvg || safeBasePrice;
  const trend = safeAvg7d > 0 && safeAvg24h > 0
    ? (safeAvg24h - safeAvg7d) / safeAvg7d
    : 0;

  let recommendedPrice;
  let strategy = 'balanced';

  if (safeAvg7d > 0 && safeAvg24h > 0 && trend > 0.2) {
    recommendedPrice = Math.floor(safeAvg24h * 1.1);
    strategy = 'surge';
  } else if (safeAvg7d > 0 && safeAvg24h > 0 && trend < -0.2) {
    recommendedPrice = Math.floor(safeAvg24h * 0.9);
    strategy = 'drop';
  } else if (safeRecentAvg > 0) {
    recommendedPrice = Math.round(safeRecentAvg);
    strategy = 'balanced';
  } else if (safeAvg24h > 0) {
    recommendedPrice = Math.round(safeAvg24h);
    strategy = 'fallback_24h';
  } else if (safeAvg7d > 0) {
    recommendedPrice = Math.round(safeAvg7d);
    strategy = 'fallback_7d';
  } else {
    recommendedPrice = safeBasePrice;
    strategy = 'fallback_base';
  }

  const bounded = Math.max(1, Math.round(recommendedPrice || anchorPrice || safeBasePrice));

  return {
    recommendedPrice: bounded,
    trend,
    strategy,
    quickSellPrice: Math.max(1, Math.floor(bounded * 0.94)),
    highProfitPrice: Math.max(1, Math.ceil(bounded * 1.06)),
  };
}

function calculateRecentAverage(recentTrades = []) {
  if (!Array.isArray(recentTrades) || recentTrades.length === 0) {
    return 0;
  }

  let weightedTotalPrice = 0;
  let weightedTotalQuantity = 0;

  recentTrades.forEach((trade) => {
    const quantity = toSafePositiveNumber(trade.quantity, 0);
    const totalPrice = toSafePositiveNumber(trade.price, 0);

    if (quantity <= 0 || totalPrice <= 0) {
      return;
    }

    weightedTotalPrice += totalPrice;
    weightedTotalQuantity += quantity;
  });

  return toAverageUnitPrice(weightedTotalPrice, weightedTotalQuantity, 0);
}

async function getResourcePriceRecommendation(
  prisma,
  itemKey,
  {
    now = new Date(),
    recentTradeLimit = DEFAULT_RECENT_TRADE_LIMIT,
  } = {},
) {
  const safeRecentTradeLimit = toPositiveInt(recentTradeLimit, DEFAULT_RECENT_TRADE_LIMIT);
  const start7d = new Date(now.getTime() - 7 * MS_IN_DAY);
  const start24h = new Date(now.getTime() - 24 * MS_IN_HOUR);
  const basePrice = getResourceBasePrice(itemKey);

  const [agg7d, agg24h, recentTrades] = await Promise.all([
    prisma.tradeHistory.aggregate({
      where: {
        itemType: 'resource',
        itemKey,
        createdAt: {
          gte: start7d,
          lte: now,
        },
      },
      _sum: {
        price: true,
        quantity: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.tradeHistory.aggregate({
      where: {
        itemType: 'resource',
        itemKey,
        createdAt: {
          gte: start24h,
          lte: now,
        },
      },
      _sum: {
        price: true,
        quantity: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.tradeHistory.findMany({
      where: {
        itemType: 'resource',
        itemKey,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeRecentTradeLimit,
      select: {
        quantity: true,
        price: true,
      },
    }),
  ]);

  const totalPrice7d = toSafePositiveNumber(agg7d?._sum?.price, 0);
  const totalQuantity7d = toSafePositiveNumber(agg7d?._sum?.quantity, 0);
  const totalPrice24h = toSafePositiveNumber(agg24h?._sum?.price, 0);
  const totalQuantity24h = toSafePositiveNumber(agg24h?._sum?.quantity, 0);
  const tradeCount7d = toSafePositiveNumber(agg7d?._count?._all, 0);
  const tradeCount24h = toSafePositiveNumber(agg24h?._count?._all, 0);
  const recentRows = Array.isArray(recentTrades) ? recentTrades : [];

  const avg7d = toAverageUnitPrice(totalPrice7d, totalQuantity7d, 0);
  const avg24h = toAverageUnitPrice(totalPrice24h, totalQuantity24h, 0);
  const recentAvg = calculateRecentAverage(recentRows);
  const recommendation = resolveRecommendedPrice({
    avg7d,
    avg24h,
    recentAvg,
    basePrice,
  });
  const confidence = calculateConfidence({
    tradeCount7d,
    tradeCount24h,
    recentCount: recentRows.length,
    totalQuantity7d,
    totalQuantity24h,
  });

  return {
    itemKey,
    itemName: toResourceName(itemKey),
    itemEmoji: toResourceEmoji(itemKey),
    basePrice,
    avg7d: avg7d || basePrice,
    avg24h: avg24h || avg7d || basePrice,
    recentAvg: recentAvg || avg24h || avg7d || basePrice,
    trendRate: recommendation.trend,
    trendDirection: toTrendDirection(recommendation.trend),
    tradeCount7d,
    tradeCount24h,
    recentTradeCount: recentRows.length,
    confidence,
    recommendedPrice: recommendation.recommendedPrice,
    quickSellPrice: recommendation.quickSellPrice,
    highProfitPrice: recommendation.highProfitPrice,
    strategy: recommendation.strategy,
  };
}

module.exports = {
  DEFAULT_RECENT_TRADE_LIMIT,
  calculateConfidence,
  resolveRecommendedPrice,
  getResourcePriceRecommendation,
};
