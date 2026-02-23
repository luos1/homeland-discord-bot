const FEE_CONFIG_KEYS = {
  market: 'market_fee',
  gem: 'gem_fee',
  auction: 'auction_fee',
};

const AUTO_ADJUST_RULE = {
  lowVolume: 100000,
  highVolume: 1000000,
  divisor: 10000000,
};

const FEE_DEFAULTS = {
  [FEE_CONFIG_KEYS.market]: {
    label: '거래소',
    baseRate: 0.1,
    currentRate: 0.1,
    minRate: 0.03,
    maxRate: 0.2,
    midRate: 0.07,
    autoAdjust: true,
  },
  [FEE_CONFIG_KEYS.gem]: {
    label: '젬 교환',
    baseRate: 0.05,
    currentRate: 0.05,
    minRate: 0.02,
    maxRate: 0.1,
    midRate: 0.04,
    autoAdjust: true,
  },
  [FEE_CONFIG_KEYS.auction]: {
    label: '경매',
    baseRate: 0.05,
    currentRate: 0.05,
    minRate: 0.02,
    maxRate: 0.12,
    midRate: 0.04,
    autoAdjust: true,
  },
};

const RATE_EPSILON = 0.0001;
const MS_IN_HOUR = 60 * 60 * 1000;

function toSafeRate(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampRate(rate, minRate, maxRate) {
  return Math.min(maxRate, Math.max(minRate, rate));
}

function roundRate(rate) {
  return Number(rate.toFixed(4));
}

function toDefaultConfig(configKey) {
  return FEE_DEFAULTS[configKey] || FEE_DEFAULTS[FEE_CONFIG_KEYS.market];
}

function normalizeFeeConfig(raw, configKey) {
  const defaults = toDefaultConfig(configKey);
  const minRate = toSafeRate(raw?.minRate, defaults.minRate);
  const maxRate = toSafeRate(raw?.maxRate, defaults.maxRate);
  const baseRate = clampRate(toSafeRate(raw?.baseRate, defaults.baseRate), minRate, maxRate);
  const currentRate = clampRate(toSafeRate(raw?.currentRate, defaults.currentRate), minRate, maxRate);
  const midRate = clampRate(toSafeRate(raw?.midRate, defaults.midRate), minRate, maxRate);

  return {
    configKey,
    label: defaults.label,
    baseRate: roundRate(baseRate),
    currentRate: roundRate(currentRate),
    minRate: roundRate(minRate),
    maxRate: roundRate(maxRate),
    midRate: roundRate(midRate),
    autoAdjust: raw?.autoAdjust ?? defaults.autoAdjust,
    lastAdjusted: raw?.lastAdjusted || new Date(),
    adjustedBy: raw?.adjustedBy || null,
  };
}

function calculateAutoAdjustedRate({
  dailyTradeVolume = 0,
  baseRate,
  minRate,
  maxRate,
  midRate,
}) {
  const safeVolume = Math.max(0, Math.floor(Number(dailyTradeVolume) || 0));
  let nextRate;

  if (safeVolume > AUTO_ADJUST_RULE.highVolume) {
    nextRate = Math.max(minRate, baseRate - safeVolume / AUTO_ADJUST_RULE.divisor);
  } else if (safeVolume < AUTO_ADJUST_RULE.lowVolume) {
    nextRate = baseRate;
  } else {
    nextRate = midRate;
  }

  return roundRate(clampRate(nextRate, minRate, maxRate));
}

async function getDailyTradeVolume(prisma, { now = new Date(), lookbackHours = 24 } = {}) {
  const since = new Date(now.getTime() - lookbackHours * MS_IN_HOUR);
  const [tradeAgg, gemAgg] = await Promise.all([
    prisma.tradeHistory.aggregate({
      where: {
        createdAt: {
          gte: since,
          lte: now,
        },
      },
      _sum: {
        price: true,
      },
    }),
    prisma.gemExchange.aggregate({
      where: {
        status: 'filled',
        createdAt: {
          gte: since,
          lte: now,
        },
      },
      _sum: {
        goldAmount: true,
      },
    }),
  ]);

  const marketVolume = tradeAgg?._sum?.price || 0;
  const gemVolume = gemAgg?._sum?.goldAmount || 0;
  return marketVolume + gemVolume;
}

async function ensureFeeConfig(prisma, configKey) {
  const defaults = toDefaultConfig(configKey);
  const createdOrFound = await prisma.feeConfig.upsert({
    where: {
      configKey,
    },
    update: {},
    create: {
      configKey,
      baseRate: defaults.baseRate,
      currentRate: defaults.currentRate,
      minRate: defaults.minRate,
      maxRate: defaults.maxRate,
      autoAdjust: defaults.autoAdjust,
      adjustedBy: 'system:init',
    },
  });

  return normalizeFeeConfig(createdOrFound, configKey);
}

async function refreshFeeConfig(
  prisma,
  configKey,
  {
    now = new Date(),
    dailyTradeVolume = null,
  } = {},
) {
  const current = await ensureFeeConfig(prisma, configKey);
  const volume = Number.isFinite(dailyTradeVolume)
    ? Math.max(0, dailyTradeVolume)
    : await getDailyTradeVolume(prisma, { now });
  const targetRate = current.autoAdjust
    ? calculateAutoAdjustedRate({
      dailyTradeVolume: volume,
      baseRate: current.baseRate,
      minRate: current.minRate,
      maxRate: current.maxRate,
      midRate: current.midRate,
    })
    : current.currentRate;

  if (!current.autoAdjust || Math.abs(targetRate - current.currentRate) < RATE_EPSILON) {
    return {
      ...current,
      targetRate,
      dailyTradeVolume: volume,
      wasAdjusted: false,
    };
  }

  const updated = await prisma.feeConfig.update({
    where: {
      configKey,
    },
    data: {
      currentRate: targetRate,
      lastAdjusted: now,
      adjustedBy: 'system:auto',
    },
  });

  return {
    ...normalizeFeeConfig(updated, configKey),
    targetRate,
    dailyTradeVolume: volume,
    wasAdjusted: true,
  };
}

async function resolveFeeRate(prisma, configKey, { now = new Date() } = {}) {
  const config = await refreshFeeConfig(prisma, configKey, { now });
  return config.currentRate;
}

async function setFeeRate(
  prisma,
  configKey,
  {
    rate,
    adjustedBy = 'system',
    disableAuto = true,
    now = new Date(),
  } = {},
) {
  const current = await ensureFeeConfig(prisma, configKey);
  const nextRate = roundRate(clampRate(
    toSafeRate(rate, current.currentRate),
    current.minRate,
    current.maxRate,
  ));

  const updated = await prisma.feeConfig.update({
    where: {
      configKey,
    },
    data: {
      currentRate: nextRate,
      autoAdjust: disableAuto ? false : current.autoAdjust,
      lastAdjusted: now,
      adjustedBy,
    },
  });

  return normalizeFeeConfig(updated, configKey);
}

async function adjustFeeRateByStep(
  prisma,
  configKey,
  {
    deltaRate,
    adjustedBy = 'system',
    now = new Date(),
  } = {},
) {
  const current = await ensureFeeConfig(prisma, configKey);
  return setFeeRate(prisma, configKey, {
    rate: current.currentRate + (Number(deltaRate) || 0),
    adjustedBy,
    disableAuto: true,
    now,
  });
}

async function setFeeAutoAdjust(
  prisma,
  configKey,
  {
    enabled,
    adjustedBy = 'system',
    now = new Date(),
  } = {},
) {
  await ensureFeeConfig(prisma, configKey);
  const updated = await prisma.feeConfig.update({
    where: {
      configKey,
    },
    data: {
      autoAdjust: Boolean(enabled),
      lastAdjusted: now,
      adjustedBy,
    },
  });

  const normalized = normalizeFeeConfig(updated, configKey);
  if (normalized.autoAdjust) {
    return refreshFeeConfig(prisma, configKey, { now });
  }

  return normalized;
}

async function toggleFeeAutoAdjust(prisma, configKey, { adjustedBy = 'system', now = new Date() } = {}) {
  const current = await ensureFeeConfig(prisma, configKey);
  return setFeeAutoAdjust(prisma, configKey, {
    enabled: !current.autoAdjust,
    adjustedBy,
    now,
  });
}

async function getFeeDashboard(prisma, { now = new Date() } = {}) {
  const dailyTradeVolume = await getDailyTradeVolume(prisma, { now });
  const [marketFee, gemFee, auctionFee] = await Promise.all([
    refreshFeeConfig(prisma, FEE_CONFIG_KEYS.market, { now, dailyTradeVolume }),
    refreshFeeConfig(prisma, FEE_CONFIG_KEYS.gem, { now, dailyTradeVolume }),
    refreshFeeConfig(prisma, FEE_CONFIG_KEYS.auction, { now, dailyTradeVolume }),
  ]);

  return {
    dailyTradeVolume,
    thresholdLow: AUTO_ADJUST_RULE.lowVolume,
    thresholdHigh: AUTO_ADJUST_RULE.highVolume,
    configs: {
      [FEE_CONFIG_KEYS.market]: marketFee,
      [FEE_CONFIG_KEYS.gem]: gemFee,
      [FEE_CONFIG_KEYS.auction]: auctionFee,
    },
  };
}

function formatFeePercent(rate) {
  return `${(toSafeRate(rate, 0) * 100).toFixed(2)}%`;
}

module.exports = {
  FEE_CONFIG_KEYS,
  FEE_DEFAULTS,
  AUTO_ADJUST_RULE,
  calculateAutoAdjustedRate,
  getDailyTradeVolume,
  ensureFeeConfig,
  refreshFeeConfig,
  resolveFeeRate,
  setFeeRate,
  adjustFeeRateByStep,
  setFeeAutoAdjust,
  toggleFeeAutoAdjust,
  getFeeDashboard,
  formatFeePercent,
};
