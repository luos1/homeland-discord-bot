const { FEE_CONFIG_KEYS, FEE_DEFAULTS } = require('./fee-config');

const DEFAULT_GEM_RATE = 120;
const MIN_GEM_RATE = 60;
const MAX_GEM_RATE = 500;
const GEM_EXCHANGE_FEE_RATE = FEE_DEFAULTS[FEE_CONFIG_KEYS.gem].currentRate;
const GEM_MARKET_LOOKBACK_HOURS = 24;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeOrderType(orderType) {
  if (orderType === 'buy' || orderType === 'sell') {
    return orderType;
  }

  return null;
}

function calculateGemMarketRate(exchanges = []) {
  if (!Array.isArray(exchanges) || exchanges.length === 0) {
    return DEFAULT_GEM_RATE;
  }

  let demand = 0;
  let supply = 0;
  let weightedRateSum = 0;
  let weightedAmountSum = 0;

  exchanges.forEach((exchange) => {
    const type = normalizeOrderType(exchange.orderType);
    const amount = Number(exchange.amount) || 0;
    const rate = Number(exchange.rate) || DEFAULT_GEM_RATE;

    if (amount <= 0) {
      return;
    }

    if (type === 'buy') {
      demand += amount;
    } else if (type === 'sell') {
      supply += amount;
    }

    weightedRateSum += rate * amount;
    weightedAmountSum += amount;
  });

  const baseRate =
    weightedAmountSum > 0
      ? Math.round(weightedRateSum / weightedAmountSum)
      : DEFAULT_GEM_RATE;
  const imbalanceFactor = (demand + 1) / (supply + 1);
  const adjustedRate = Math.round(baseRate * clamp(imbalanceFactor, 0.75, 1.25));

  return clamp(adjustedRate, MIN_GEM_RATE, MAX_GEM_RATE);
}

function calculateExchangeQuote({ orderType, amount, rate, feeRate = GEM_EXCHANGE_FEE_RATE }) {
  const side = normalizeOrderType(orderType);

  if (!side) {
    throw new Error(`Unsupported order type: ${orderType}`);
  }

  const safeAmount = Math.max(0, Math.floor(amount));
  const safeRate = Math.max(1, Math.floor(rate));
  const grossGold = safeAmount * safeRate;
  const fee = Math.ceil(grossGold * feeRate);

  if (side === 'buy') {
    return {
      orderType: side,
      amount: safeAmount,
      rate: safeRate,
      grossGold,
      fee,
      totalGoldCost: grossGold + fee,
      netGoldPayout: 0,
    };
  }

  return {
    orderType: side,
    amount: safeAmount,
    rate: safeRate,
    grossGold,
    fee,
    totalGoldCost: 0,
    netGoldPayout: Math.max(0, grossGold - fee),
  };
}

async function getGemMarketSnapshot(prisma, now = new Date()) {
  const lookbackDate = new Date(
    now.getTime() - GEM_MARKET_LOOKBACK_HOURS * 60 * 60 * 1000,
  );

  const recentExchanges = await prisma.gemExchange.findMany({
    where: {
      status: 'filled',
      createdAt: {
        gte: lookbackDate,
      },
    },
    select: {
      orderType: true,
      amount: true,
      rate: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  let demand = 0;
  let supply = 0;
  let volume = 0;

  recentExchanges.forEach((exchange) => {
    const amount = Math.max(0, Number(exchange.amount) || 0);
    volume += amount;

    if (exchange.orderType === 'buy') {
      demand += amount;
    } else if (exchange.orderType === 'sell') {
      supply += amount;
    }
  });

  return {
    since: lookbackDate,
    rate: calculateGemMarketRate(recentExchanges),
    demand,
    supply,
    volume,
    recentCount: recentExchanges.length,
  };
}

module.exports = {
  DEFAULT_GEM_RATE,
  MIN_GEM_RATE,
  MAX_GEM_RATE,
  GEM_EXCHANGE_FEE_RATE,
  GEM_MARKET_LOOKBACK_HOURS,
  normalizeOrderType,
  calculateGemMarketRate,
  calculateExchangeQuote,
  getGemMarketSnapshot,
};
