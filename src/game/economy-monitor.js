const { RESOURCES } = require('./production-classes');

const SNAPSHOT_TYPES = {
  hourly: 'hourly',
  daily: 'daily',
  manual: 'manual',
};

const ALERT_TYPES = {
  inflation: 'inflation',
  abnormalTrade: 'abnormal_trade',
};

const ALERT_SEVERITIES = {
  warn: 'warn',
  critical: 'critical',
};

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;

const DEFAULTS = {
  priceLookbackHours: 24,
  inflationThresholdRate: 0.2,
  abnormalTradeMultiplier: 3,
  abnormalTradeLookbackHours: 24,
  statsLimit: 10,
  tradeActivityDays: 7,
  priceTrendDays: 7,
};

const STATS_ITEM_TYPES = {
  all: 'all',
  resource: 'resource',
  equipment: 'equipment',
};

const SPARKLINE_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function normalizeSnapshotType(snapshotType) {
  if (snapshotType && SNAPSHOT_TYPES[snapshotType]) {
    return snapshotType;
  }

  return SNAPSHOT_TYPES.manual;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toSafeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function toResourceName(resourceType, fallbackName = null) {
  return RESOURCES[resourceType]?.name || fallbackName || resourceType;
}

function toResourceEmoji(resourceType) {
  return RESOURCES[resourceType]?.emoji || '📦';
}

function normalizeStatsItemType(itemType) {
  if (itemType && STATS_ITEM_TYPES[itemType]) {
    return itemType;
  }

  return STATS_ITEM_TYPES.all;
}

function toItemDisplayName(itemType, itemKey, fallbackName = null) {
  if (itemType === STATS_ITEM_TYPES.resource) {
    return toResourceName(itemKey, fallbackName || itemKey);
  }

  if (itemType === STATS_ITEM_TYPES.equipment) {
    return fallbackName || `장비#${itemKey}`;
  }

  return fallbackName || itemKey;
}

function toItemEmoji(itemType, itemKey) {
  if (itemType === STATS_ITEM_TYPES.resource) {
    return toResourceEmoji(itemKey);
  }

  if (itemType === STATS_ITEM_TYPES.equipment) {
    return '⚔️';
  }

  return '📦';
}

function parseSnapshotMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  return raw;
}

function buildResourceCirculationMap(groupedResources) {
  return groupedResources.reduce((acc, row) => {
    const quantity = row?._sum?.quantity || 0;
    acc[row.type] = {
      type: row.type,
      name: toResourceName(row.type),
      emoji: toResourceEmoji(row.type),
      quantity,
    };
    return acc;
  }, {});
}

function buildAveragePriceMap(groupedPrices) {
  return groupedPrices.reduce((acc, row) => {
    const totalQuantity = row?._sum?.quantity || 0;
    const totalPrice = row?._sum?.price || 0;
    const tradeCount = row?._count?._all || 0;
    const averagePrice = totalQuantity > 0
      ? Math.round(totalPrice / totalQuantity)
      : 0;

    acc[row.itemKey] = {
      resourceType: row.itemKey,
      resourceName: toResourceName(row.itemKey, row.itemName),
      averagePrice,
      tradeCount,
      totalQuantity,
      totalPrice,
    };
    return acc;
  }, {});
}

function toSortedResourceList(resourceMap) {
  return Object.values(parseSnapshotMap(resourceMap))
    .sort((a, b) => b.quantity - a.quantity || a.type.localeCompare(b.type));
}

function toSortedPriceList(priceMap) {
  return Object.values(parseSnapshotMap(priceMap))
    .sort((a, b) => b.averagePrice - a.averagePrice || a.resourceType.localeCompare(b.resourceType));
}

function buildAlertPayload({ type, severity, message, metadata = null }) {
  return {
    alertType: type,
    severity,
    message,
    metadata,
  };
}

async function persistEconomyAlerts(prisma, alerts) {
  if (!alerts || alerts.length === 0) {
    return;
  }

  await prisma.economyAlert.createMany({
    data: alerts.map((alert) => ({
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata || undefined,
    })),
  });
}

async function getGroupedResourcePrices(prisma, { fromDate = null, toDate = null } = {}) {
  const where = {
    itemType: 'resource',
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = fromDate;
    }
    if (toDate) {
      where.createdAt.lte = toDate;
    }
  }

  return prisma.tradeHistory.groupBy({
    by: ['itemKey'],
    where,
    _sum: {
      quantity: true,
      price: true,
    },
    _count: {
      _all: true,
    },
  });
}

function buildItemPriceHistoryRowsFromTrades(trades, timestamp) {
  const grouped = new Map();

  (Array.isArray(trades) ? trades : []).forEach((trade) => {
    const itemType = trade?.itemType;
    const itemKey = trade?.itemKey;
    const quantity = trade?.quantity || 0;
    const price = trade?.price || 0;

    if (!itemType || !itemKey || quantity <= 0 || price <= 0) {
      return;
    }

    const unitPrice = Math.max(1, Math.round(price / quantity));
    const key = `${itemType}:${itemKey}`;
    const current = grouped.get(key) || {
      itemType,
      itemKey,
      totalPrice: 0,
      totalQuantity: 0,
      minPrice: unitPrice,
      maxPrice: unitPrice,
    };

    current.totalPrice += price;
    current.totalQuantity += quantity;
    current.minPrice = Math.min(current.minPrice, unitPrice);
    current.maxPrice = Math.max(current.maxPrice, unitPrice);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((entry) => ({
    itemType: entry.itemType,
    itemKey: entry.itemKey,
    avgPrice: Math.max(1, Math.round(entry.totalPrice / Math.max(entry.totalQuantity, 1))),
    minPrice: Math.max(1, entry.minPrice),
    maxPrice: Math.max(1, entry.maxPrice),
    volume: Math.max(0, entry.totalQuantity),
    recordedAt: timestamp,
  }));
}

async function createEconomySnapshot(
  prisma,
  {
    snapshotType = SNAPSHOT_TYPES.manual,
    timestamp = new Date(),
    priceLookbackHours = DEFAULTS.priceLookbackHours,
  } = {},
) {
  const normalizedSnapshotType = normalizeSnapshotType(snapshotType);
  const lookbackHours = toPositiveInt(priceLookbackHours, DEFAULTS.priceLookbackHours);
  const priceWindowStart = new Date(timestamp.getTime() - lookbackHours * MS_IN_HOUR);

  const [goldAgg, tradeVolumeAgg, groupedResources, groupedPrices, pricedTrades] = await Promise.all([
    prisma.character.aggregate({
      _sum: {
        gold: true,
      },
    }),
    prisma.tradeHistory.aggregate({
      _sum: {
        price: true,
      },
    }),
    prisma.resource.groupBy({
      by: ['type'],
      _sum: {
        quantity: true,
      },
    }),
    getGroupedResourcePrices(prisma, {
      fromDate: priceWindowStart,
      toDate: timestamp,
    }),
    prisma.tradeHistory.findMany({
      where: {
        createdAt: {
          gte: priceWindowStart,
          lte: timestamp,
        },
      },
      select: {
        itemType: true,
        itemKey: true,
        quantity: true,
        price: true,
      },
    }),
  ]);

  const resourceMap = buildResourceCirculationMap(groupedResources);
  const averagePriceMap = buildAveragePriceMap(groupedPrices);
  const totalGold = goldAgg?._sum?.gold || 0;
  const totalTradeVolume = tradeVolumeAgg?._sum?.price || 0;

  const snapshot = await prisma.economySnapshot.create({
    data: {
      snapshotType: normalizedSnapshotType,
      totalGold,
      totalTradeVolume,
      resources: resourceMap,
      averagePrices: averagePriceMap,
      createdAt: timestamp,
    },
  });

  const priceHistoryRows = Object.values(averagePriceMap).map((entry) => ({
    resourceType: entry.resourceType,
    resourceName: entry.resourceName,
    averagePrice: entry.averagePrice,
    tradeCount: entry.tradeCount,
    totalQuantity: entry.totalQuantity,
    snapshotType: normalizedSnapshotType,
    createdAt: timestamp,
  }));

  if (priceHistoryRows.length > 0) {
    await prisma.resourcePriceHistory.createMany({
      data: priceHistoryRows,
    });
  }

  const itemPriceHistoryRows = buildItemPriceHistoryRowsFromTrades(pricedTrades, timestamp);
  if (itemPriceHistoryRows.length > 0) {
    await prisma.itemPriceHistory.createMany({
      data: itemPriceHistoryRows,
    });
  }

  return snapshot;
}

function extractPriceTrend(currentSnapshot, previousSnapshot) {
  const currentPriceMap = parseSnapshotMap(currentSnapshot?.averagePrices);
  const previousPriceMap = parseSnapshotMap(previousSnapshot?.averagePrices);
  const entries = [];

  Object.values(currentPriceMap).forEach((entry) => {
    const previous = previousPriceMap[entry.resourceType];
    const previousPrice = previous?.averagePrice || 0;
    const currentPrice = entry.averagePrice || 0;
    const changeRate = previousPrice > 0
      ? ((currentPrice - previousPrice) / previousPrice) * 100
      : null;

    entries.push({
      resourceType: entry.resourceType,
      resourceName: entry.resourceName || toResourceName(entry.resourceType),
      currentPrice,
      previousPrice,
      changeRate,
    });
  });

  return entries.sort((a, b) => {
    if (a.changeRate === null && b.changeRate === null) {
      return b.currentPrice - a.currentPrice;
    }
    if (a.changeRate === null) {
      return 1;
    }
    if (b.changeRate === null) {
      return -1;
    }

    return Math.abs(b.changeRate) - Math.abs(a.changeRate);
  });
}

async function getRecentSnapshots(prisma, { snapshotType = SNAPSHOT_TYPES.hourly, take = 2 } = {}) {
  return prisma.economySnapshot.findMany({
    where: {
      snapshotType: normalizeSnapshotType(snapshotType),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: toPositiveInt(take, 2),
  });
}

async function getEconomyDashboard(
  prisma,
  {
    snapshotType = SNAPSHOT_TYPES.hourly,
    createIfMissing = true,
    now = new Date(),
  } = {},
) {
  let snapshots = await getRecentSnapshots(prisma, {
    snapshotType,
    take: 2,
  });

  if (snapshots.length === 0 && createIfMissing) {
    await createEconomySnapshot(prisma, {
      snapshotType,
      timestamp: now,
    });
    snapshots = await getRecentSnapshots(prisma, {
      snapshotType,
      take: 2,
    });
  }

  const latestSnapshot = snapshots[0] || null;
  const previousSnapshot = snapshots[1] || null;
  const last24Hours = new Date(now.getTime() - MS_IN_DAY);

  const [tradeVolumeAllAgg, tradeVolume24hAgg, tradeCount24h] = await Promise.all([
    prisma.tradeHistory.aggregate({
      _sum: {
        price: true,
      },
    }),
    prisma.tradeHistory.aggregate({
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
      _sum: {
        price: true,
      },
    }),
    prisma.tradeHistory.count({
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
    }),
  ]);

  const resourceCirculation = latestSnapshot
    ? toSortedResourceList(latestSnapshot.resources)
    : [];
  const averagePriceTrend = extractPriceTrend(latestSnapshot, previousSnapshot);

  return {
    snapshotType: normalizeSnapshotType(snapshotType),
    snapshot: latestSnapshot,
    previousSnapshot,
    totalGold: latestSnapshot?.totalGold || 0,
    resourceCirculation,
    tradeVolume: {
      allTime: tradeVolumeAllAgg?._sum?.price || 0,
      last24h: tradeVolume24hAgg?._sum?.price || 0,
      tradeCount24h: tradeCount24h || 0,
    },
    averagePriceTrend,
  };
}

function buildInflationAlerts({ currentSnapshot, previousSnapshot, thresholdRate }) {
  if (!currentSnapshot || !previousSnapshot) {
    return [];
  }

  const alerts = [];
  const currentPriceMap = parseSnapshotMap(currentSnapshot.averagePrices);
  const previousPriceMap = parseSnapshotMap(previousSnapshot.averagePrices);

  Object.values(currentPriceMap).forEach((entry) => {
    const previousEntry = previousPriceMap[entry.resourceType];

    if (!previousEntry || previousEntry.averagePrice <= 0) {
      return;
    }

    const previousPrice = previousEntry.averagePrice;
    const currentPrice = entry.averagePrice || 0;
    const rate = (currentPrice - previousPrice) / previousPrice;

    if (rate < thresholdRate) {
      return;
    }

    const severity = rate >= thresholdRate * 2
      ? ALERT_SEVERITIES.critical
      : ALERT_SEVERITIES.warn;
    const percent = Math.round(rate * 100);

    alerts.push(
      buildAlertPayload({
        type: ALERT_TYPES.inflation,
        severity,
        message: `${entry.resourceName} 평균 가격 급등 (${previousPrice}G -> ${currentPrice}G, +${percent}%)`,
        metadata: {
          resourceType: entry.resourceType,
          previousPrice,
          currentPrice,
          rate,
          snapshotType: currentSnapshot.snapshotType,
          currentSnapshotId: currentSnapshot.id,
          previousSnapshotId: previousSnapshot.id,
        },
      }),
    );
  });

  if (previousSnapshot.totalGold > 0) {
    const totalGoldRate = (currentSnapshot.totalGold - previousSnapshot.totalGold) / previousSnapshot.totalGold;
    if (totalGoldRate >= thresholdRate) {
      const severity = totalGoldRate >= thresholdRate * 2
        ? ALERT_SEVERITIES.critical
        : ALERT_SEVERITIES.warn;
      const percent = Math.round(totalGoldRate * 100);

      alerts.push(
        buildAlertPayload({
          type: ALERT_TYPES.inflation,
          severity,
          message: `전체 골드 유통량 급증 (${previousSnapshot.totalGold}G -> ${currentSnapshot.totalGold}G, +${percent}%)`,
          metadata: {
            previousTotalGold: previousSnapshot.totalGold,
            currentTotalGold: currentSnapshot.totalGold,
            rate: totalGoldRate,
            snapshotType: currentSnapshot.snapshotType,
            currentSnapshotId: currentSnapshot.id,
            previousSnapshotId: previousSnapshot.id,
          },
        }),
      );
    }
  }

  return alerts;
}

async function detectInflationAlerts(
  prisma,
  {
    snapshotType = SNAPSHOT_TYPES.hourly,
    thresholdRate = DEFAULTS.inflationThresholdRate,
    persist = true,
  } = {},
) {
  const [currentSnapshot, previousSnapshot] = await getRecentSnapshots(prisma, {
    snapshotType,
    take: 2,
  });
  const alerts = buildInflationAlerts({
    currentSnapshot,
    previousSnapshot,
    thresholdRate: toSafeNumber(thresholdRate) || DEFAULTS.inflationThresholdRate,
  });

  if (persist) {
    await persistEconomyAlerts(prisma, alerts);
  }

  return alerts;
}

async function detectAbnormalTrades(
  prisma,
  {
    now = new Date(),
    lookbackHours = DEFAULTS.abnormalTradeLookbackHours,
    multiplier = DEFAULTS.abnormalTradeMultiplier,
    persist = true,
  } = {},
) {
  const safeLookbackHours = toPositiveInt(lookbackHours, DEFAULTS.abnormalTradeLookbackHours);
  const safeMultiplier = toSafeNumber(multiplier) > 1
    ? toSafeNumber(multiplier)
    : DEFAULTS.abnormalTradeMultiplier;
  const startTime = new Date(now.getTime() - safeLookbackHours * MS_IN_HOUR);
  const baselineStart = new Date(now.getTime() - (safeLookbackHours + 24 * 7) * MS_IN_HOUR);

  const [recentTrades, groupedBaseline] = await Promise.all([
    prisma.tradeHistory.findMany({
      where: {
        itemType: 'resource',
        createdAt: {
          gte: startTime,
          lte: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    }),
    getGroupedResourcePrices(prisma, {
      fromDate: baselineStart,
      toDate: now,
    }),
  ]);

  if (recentTrades.length === 0) {
    return [];
  }

  const baselineMap = buildAveragePriceMap(groupedBaseline);
  const alerts = [];

  recentTrades.forEach((trade) => {
    if (!trade.quantity || trade.quantity <= 0) {
      return;
    }

    const baseline = baselineMap[trade.itemKey];
    if (!baseline || baseline.averagePrice <= 0) {
      return;
    }

    const unitPrice = Math.round(trade.price / trade.quantity);
    const highThreshold = baseline.averagePrice * safeMultiplier;
    const lowThreshold = baseline.averagePrice / safeMultiplier;
    const isHigh = unitPrice >= highThreshold;
    const isLow = unitPrice <= lowThreshold;

    if (!isHigh && !isLow) {
      return;
    }

    const ratio = unitPrice / baseline.averagePrice;
    const severity = ratio >= safeMultiplier * 1.5 || ratio <= (1 / safeMultiplier) / 1.5
      ? ALERT_SEVERITIES.critical
      : ALERT_SEVERITIES.warn;
    const direction = isHigh ? '고가' : '저가';

    alerts.push(
      buildAlertPayload({
        type: ALERT_TYPES.abnormalTrade,
        severity,
        message: `${trade.itemName} ${direction} 거래 감지 (${unitPrice}G/개, 기준 ${baseline.averagePrice}G/개)`,
        metadata: {
          tradeId: trade.id,
          itemKey: trade.itemKey,
          itemName: trade.itemName,
          quantity: trade.quantity,
          totalPrice: trade.price,
          unitPrice,
          baselinePrice: baseline.averagePrice,
          ratio,
          sellerId: trade.sellerId,
          buyerId: trade.buyerId,
          createdAt: trade.createdAt,
        },
      }),
    );
  });

  if (persist) {
    await persistEconomyAlerts(prisma, alerts);
  }

  return alerts;
}

async function runEconomyAlertChecks(
  prisma,
  {
    now = new Date(),
    snapshotType = SNAPSHOT_TYPES.hourly,
    inflationThresholdRate = DEFAULTS.inflationThresholdRate,
    abnormalTradeMultiplier = DEFAULTS.abnormalTradeMultiplier,
    abnormalTradeLookbackHours = DEFAULTS.abnormalTradeLookbackHours,
    persist = true,
  } = {},
) {
  const [inflationAlerts, abnormalTradeAlerts] = await Promise.all([
    detectInflationAlerts(prisma, {
      snapshotType,
      thresholdRate: inflationThresholdRate,
      persist: false,
    }),
    detectAbnormalTrades(prisma, {
      now,
      lookbackHours: abnormalTradeLookbackHours,
      multiplier: abnormalTradeMultiplier,
      persist: false,
    }),
  ]);

  const alerts = [...inflationAlerts, ...abnormalTradeAlerts];

  if (persist) {
    await persistEconomyAlerts(prisma, alerts);
  }

  return {
    inflationAlerts,
    abnormalTradeAlerts,
    alerts,
  };
}

async function getTradeVolumeTop(prisma, { limit = DEFAULTS.statsLimit } = {}) {
  const take = toPositiveInt(limit, DEFAULTS.statsLimit);
  const rows = await prisma.character.findMany({
    orderBy: [{ tradeVolume: 'desc' }, { id: 'asc' }],
    take,
    select: {
      id: true,
      name: true,
      tradeVolume: true,
      gold: true,
    },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    characterId: row.id,
    name: row.name,
    tradeVolume: row.tradeVolume || 0,
    gold: row.gold || 0,
  }));
}

async function getRichestRanking(prisma, { limit = DEFAULTS.statsLimit } = {}) {
  const take = toPositiveInt(limit, DEFAULTS.statsLimit);
  const rows = await prisma.character.findMany({
    orderBy: [{ gold: 'desc' }, { id: 'asc' }],
    take,
    select: {
      id: true,
      name: true,
      gold: true,
      tradeVolume: true,
    },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    characterId: row.id,
    name: row.name,
    gold: row.gold || 0,
    tradeVolume: row.tradeVolume || 0,
  }));
}

function toDayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toStartOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildDayKeys(now, days) {
  const safeDays = toPositiveInt(days, DEFAULTS.priceTrendDays);
  const dayKeys = [];
  const endDay = toStartOfUtcDay(now);

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(endDay);
    day.setUTCDate(day.getUTCDate() - offset);
    dayKeys.push(toDayKey(day));
  }

  return dayKeys;
}

function createSparkline(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '데이터 없음';
  }

  const sanitized = values.map((value) => (Number.isFinite(value) && value > 0 ? value : null));
  const numeric = sanitized.filter((value) => value !== null);

  if (numeric.length === 0) {
    return '데이터 없음';
  }

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  let carry = numeric[0];

  return sanitized.map((value) => {
    const current = value === null ? carry : value;
    carry = current;

    if (max === min) {
      return SPARKLINE_BLOCKS[Math.floor((SPARKLINE_BLOCKS.length - 1) / 2)];
    }

    const ratio = (current - min) / (max - min);
    const index = Math.max(
      0,
      Math.min(
        SPARKLINE_BLOCKS.length - 1,
        Math.round(ratio * (SPARKLINE_BLOCKS.length - 1)),
      ),
    );

    return SPARKLINE_BLOCKS[index];
  }).join('');
}

function buildPriceTrendRowsFromTrades(trades) {
  return (Array.isArray(trades) ? trades : [])
    .map((trade) => {
      const quantity = trade?.quantity || 0;
      const price = trade?.price || 0;
      if (quantity <= 0 || price <= 0) {
        return null;
      }

      return {
        itemType: trade.itemType,
        itemKey: trade.itemKey,
        avgPrice: Math.max(1, Math.round(price / quantity)),
        volume: quantity,
        recordedAt: trade.createdAt,
      };
    })
    .filter(Boolean);
}

async function getItemPriceTrend(
  prisma,
  {
    now = new Date(),
    days = DEFAULTS.priceTrendDays,
    limit = 3,
    itemType = STATS_ITEM_TYPES.all,
  } = {},
) {
  const safeDays = toPositiveInt(days, DEFAULTS.priceTrendDays);
  const safeLimit = toPositiveInt(limit, 3);
  const normalizedItemType = normalizeStatsItemType(itemType);
  const dayKeys = buildDayKeys(now, safeDays);
  const rangeStart = toStartOfUtcDay(new Date(now.getTime() - (safeDays - 1) * MS_IN_DAY));

  const historyWhere = {
    recordedAt: {
      gte: rangeStart,
      lte: now,
    },
  };

  if (normalizedItemType !== STATS_ITEM_TYPES.all) {
    historyWhere.itemType = normalizedItemType;
  }

  let rows = await prisma.itemPriceHistory.findMany({
    where: historyWhere,
    select: {
      itemType: true,
      itemKey: true,
      avgPrice: true,
      volume: true,
      recordedAt: true,
    },
    orderBy: {
      recordedAt: 'asc',
    },
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    const tradeWhere = {
      createdAt: {
        gte: rangeStart,
        lte: now,
      },
    };

    if (normalizedItemType !== STATS_ITEM_TYPES.all) {
      tradeWhere.itemType = normalizedItemType;
    }

    const trades = await prisma.tradeHistory.findMany({
      where: tradeWhere,
      select: {
        itemType: true,
        itemKey: true,
        quantity: true,
        price: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    rows = buildPriceTrendRowsFromTrades(trades);
  }

  const grouped = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?.itemType || !row?.itemKey) {
      return;
    }

    const avgPrice = row?.avgPrice || 0;
    const volume = row?.volume || 0;

    if (avgPrice <= 0 || volume <= 0) {
      return;
    }

    const key = `${row.itemType}:${row.itemKey}`;
    const dayKey = toDayKey(row.recordedAt);
    const current = grouped.get(key) || {
      itemType: row.itemType,
      itemKey: row.itemKey,
      totalVolume: 0,
      daily: new Map(),
    };
    const dayEntry = current.daily.get(dayKey) || {
      weightedPrice: 0,
      volume: 0,
    };

    dayEntry.weightedPrice += avgPrice * volume;
    dayEntry.volume += volume;
    current.daily.set(dayKey, dayEntry);
    current.totalVolume += volume;
    grouped.set(key, current);
  });

  const items = Array.from(grouped.values())
    .map((entry) => {
      const series = dayKeys.map((dayKey) => {
        const day = entry.daily.get(dayKey);
        if (!day || day.volume <= 0) {
          return null;
        }

        return Math.round(day.weightedPrice / day.volume);
      });

      const validPoints = series.filter((value) => Number.isFinite(value) && value > 0);
      const firstPrice = validPoints[0] || 0;
      const lastPrice = validPoints[validPoints.length - 1] || 0;
      const changeRate = firstPrice > 0
        ? ((lastPrice - firstPrice) / firstPrice) * 100
        : null;

      return {
        itemType: entry.itemType,
        itemKey: entry.itemKey,
        itemName: toItemDisplayName(entry.itemType, entry.itemKey),
        emoji: toItemEmoji(entry.itemType, entry.itemKey),
        totalVolume: entry.totalVolume,
        series,
        sparkline: createSparkline(series),
        firstPrice,
        lastPrice,
        changeRate,
      };
    })
    .sort((a, b) => b.totalVolume - a.totalVolume || a.itemName.localeCompare(b.itemName))
    .slice(0, safeLimit);

  return {
    days: safeDays,
    itemType: normalizedItemType,
    dayKeys,
    items,
  };
}

async function getItemTradeVolumeTop(
  prisma,
  {
    limit = DEFAULTS.statsLimit,
    now = new Date(),
    days = DEFAULTS.tradeActivityDays,
    itemType = STATS_ITEM_TYPES.all,
  } = {},
) {
  const safeLimit = toPositiveInt(limit, DEFAULTS.statsLimit);
  const safeDays = toPositiveInt(days, DEFAULTS.tradeActivityDays);
  const normalizedItemType = normalizeStatsItemType(itemType);
  const start = new Date(now.getTime() - safeDays * MS_IN_DAY);

  const where = {
    createdAt: {
      gte: start,
      lte: now,
    },
  };

  if (normalizedItemType !== STATS_ITEM_TYPES.all) {
    where.itemType = normalizedItemType;
  }

  const trades = await prisma.tradeHistory.findMany({
    where,
    select: {
      itemType: true,
      itemKey: true,
      itemName: true,
      quantity: true,
      price: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const grouped = new Map();

  (Array.isArray(trades) ? trades : []).forEach((trade) => {
    if (!trade?.itemType || !trade?.itemKey) {
      return;
    }

    const key = `${trade.itemType}:${trade.itemKey}`;
    const quantity = Math.max(0, trade.quantity || 0);
    const totalPrice = Math.max(0, trade.price || 0);
    const current = grouped.get(key) || {
      itemType: trade.itemType,
      itemKey: trade.itemKey,
      itemName: toItemDisplayName(trade.itemType, trade.itemKey, trade.itemName),
      quantity: 0,
      totalVolume: 0,
      tradeCount: 0,
    };

    current.quantity += quantity;
    current.totalVolume += totalPrice;
    current.tradeCount += 1;
    if (!current.itemName || current.itemName === current.itemKey) {
      current.itemName = toItemDisplayName(trade.itemType, trade.itemKey, trade.itemName);
    }

    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.totalVolume - a.totalVolume || b.quantity - a.quantity)
    .slice(0, safeLimit)
    .map((entry, index) => ({
      rank: index + 1,
      itemType: entry.itemType,
      itemKey: entry.itemKey,
      itemName: entry.itemName,
      emoji: toItemEmoji(entry.itemType, entry.itemKey),
      quantity: entry.quantity,
      totalVolume: entry.totalVolume,
      tradeCount: entry.tradeCount,
      averageUnitPrice: entry.quantity > 0 ? Math.round(entry.totalVolume / entry.quantity) : 0,
    }));
}

async function getTradeActivity(
  prisma,
  {
    now = new Date(),
    days = DEFAULTS.tradeActivityDays,
    itemType = STATS_ITEM_TYPES.all,
  } = {},
) {
  const safeDays = toPositiveInt(days, DEFAULTS.tradeActivityDays);
  const normalizedItemType = normalizeStatsItemType(itemType);
  const start = new Date(now.getTime() - safeDays * MS_IN_DAY);
  const where = {
    createdAt: {
      gte: start,
      lte: now,
    },
  };

  if (normalizedItemType !== STATS_ITEM_TYPES.all) {
    where.itemType = normalizedItemType;
  }

  const trades = await prisma.tradeHistory.findMany({
    where,
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      createdAt: true,
      price: true,
    },
  });

  const dailyMap = new Map();
  let totalVolume = 0;

  trades.forEach((trade) => {
    const dayKey = toDayKey(trade.createdAt);
    const current = dailyMap.get(dayKey) || {
      day: dayKey,
      tradeCount: 0,
      volume: 0,
    };
    current.tradeCount += 1;
    current.volume += trade.price || 0;
    dailyMap.set(dayKey, current);
    totalVolume += trade.price || 0;
  });

  return {
    itemType: normalizedItemType,
    days: safeDays,
    totalTrades: trades.length,
    totalVolume,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

async function getEconomyStatistics(
  prisma,
  {
    limit = DEFAULTS.statsLimit,
    activityDays = DEFAULTS.tradeActivityDays,
    itemType = STATS_ITEM_TYPES.all,
    priceTrendDays = DEFAULTS.priceTrendDays,
    trendItemLimit = 3,
    now = new Date(),
  } = {},
) {
  const normalizedItemType = normalizeStatsItemType(itemType);
  const [tradeVolumeTop10, richestRanking, tradeActivity, itemTradeVolumeTop10, priceTrend7d] = await Promise.all([
    getTradeVolumeTop(prisma, { limit }),
    getRichestRanking(prisma, { limit }),
    getTradeActivity(prisma, {
      now,
      days: activityDays,
      itemType: normalizedItemType,
    }),
    getItemTradeVolumeTop(prisma, {
      limit,
      now,
      days: activityDays,
      itemType: normalizedItemType,
    }),
    getItemPriceTrend(prisma, {
      now,
      days: priceTrendDays,
      limit: trendItemLimit,
      itemType: normalizedItemType,
    }),
  ]);

  return {
    itemType: normalizedItemType,
    tradeVolumeTop10,
    itemTradeVolumeTop10,
    richestRanking,
    tradeActivity,
    priceTrend7d,
  };
}

function formatEconomyAlertLines(alerts, { maxLines = 10 } = {}) {
  if (!alerts || alerts.length === 0) {
    return ['이상 징후가 감지되지 않았습니다.'];
  }

  const lines = alerts.slice(0, maxLines).map((alert, index) => {
    const severity = alert.severity === ALERT_SEVERITIES.critical ? 'CRITICAL' : 'WARN';
    return `${index + 1}. [${severity}] ${alert.message}`;
  });

  if (alerts.length > maxLines) {
    lines.push(`... 외 ${alerts.length - maxLines}건`);
  }

  return lines;
}

async function logTradePricePoint(prisma, trade) {
  if (!trade || trade.itemType !== 'resource' || !trade.quantity || trade.quantity <= 0) {
    return;
  }

  const averagePrice = Math.round(trade.price / trade.quantity);
  await prisma.resourcePriceHistory.create({
    data: {
      resourceType: trade.itemKey,
      resourceName: toResourceName(trade.itemKey, trade.itemName),
      averagePrice,
      tradeCount: 1,
      totalQuantity: trade.quantity,
      snapshotType: 'trade',
      createdAt: trade.createdAt || new Date(),
    },
  });
}

module.exports = {
  SNAPSHOT_TYPES,
  ALERT_TYPES,
  ALERT_SEVERITIES,
  DEFAULTS,
  STATS_ITEM_TYPES,
  createEconomySnapshot,
  getEconomyDashboard,
  getEconomyStatistics,
  getTradeVolumeTop,
  getItemTradeVolumeTop,
  getItemPriceTrend,
  getRichestRanking,
  getTradeActivity,
  getRecentSnapshots,
  detectInflationAlerts,
  detectAbnormalTrades,
  runEconomyAlertChecks,
  formatEconomyAlertLines,
  logTradePricePoint,
  // 테스트용 노출
  parseSnapshotMap,
  toSortedResourceList,
  toSortedPriceList,
  createSparkline,
};
