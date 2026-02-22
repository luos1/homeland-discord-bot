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
};

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

  const [goldAgg, tradeVolumeAgg, groupedResources, groupedPrices] = await Promise.all([
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

async function getTradeActivity(
  prisma,
  {
    now = new Date(),
    days = DEFAULTS.tradeActivityDays,
  } = {},
) {
  const safeDays = toPositiveInt(days, DEFAULTS.tradeActivityDays);
  const start = new Date(now.getTime() - safeDays * MS_IN_DAY);

  const trades = await prisma.tradeHistory.findMany({
    where: {
      createdAt: {
        gte: start,
        lte: now,
      },
    },
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
    now = new Date(),
  } = {},
) {
  const [tradeVolumeTop10, richestRanking, tradeActivity] = await Promise.all([
    getTradeVolumeTop(prisma, { limit }),
    getRichestRanking(prisma, { limit }),
    getTradeActivity(prisma, {
      now,
      days: activityDays,
    }),
  ]);

  return {
    tradeVolumeTop10,
    richestRanking,
    tradeActivity,
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
  createEconomySnapshot,
  getEconomyDashboard,
  getEconomyStatistics,
  getTradeVolumeTop,
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
};
