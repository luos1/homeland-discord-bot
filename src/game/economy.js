const { RESOURCES } = require('./production-classes');

const MARKET_FEE_RATE = 0.05;
const COMBAT_GOLD_SOURCE_MULTIPLIER = 0.88;
const PRICE_LOOKBACK_HOURS = 24;

const RESOURCE_BASE_PRICE_BY_TIER = {
  1: 24,
  2: 72,
  3: 180,
  4: 420,
};

const TARGET_SUPPLY_BY_TIER = {
  1: 140,
  2: 90,
  3: 50,
  4: 24,
};

const TARGET_DEMAND_BY_TIER = {
  1: 90,
  2: 60,
  3: 35,
  4: 16,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPositiveNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return number;
}

function getResourceTier(resourceType) {
  return RESOURCES[resourceType]?.tier || 1;
}

function getResourceBasePrice(resourceType) {
  const tier = getResourceTier(resourceType);
  return RESOURCE_BASE_PRICE_BY_TIER[tier] || RESOURCE_BASE_PRICE_BY_TIER[1];
}

function resolveTrend(basePrice, currentPrice) {
  if (!basePrice || !currentPrice) {
    return 'stable';
  }

  const changeRate = (currentPrice - basePrice) / basePrice;

  if (changeRate >= 0.06) {
    return 'up';
  }

  if (changeRate <= -0.06) {
    return 'down';
  }

  return 'stable';
}

function calculateNpcResourcePrice({
  resourceType,
  supplyQuantity = 0,
  demandQuantity = 0,
  recentAveragePrice = null,
  previousPrice = null,
} = {}) {
  const tier = getResourceTier(resourceType);
  const basePrice = getResourceBasePrice(resourceType);
  const targetSupply = TARGET_SUPPLY_BY_TIER[tier] || TARGET_SUPPLY_BY_TIER[1];
  const targetDemand = TARGET_DEMAND_BY_TIER[tier] || TARGET_DEMAND_BY_TIER[1];

  const safeSupply = toPositiveNumber(supplyQuantity, 0);
  const safeDemand = toPositiveNumber(demandQuantity, 0);

  const supplyPressure = clamp((targetSupply - safeSupply) / Math.max(targetSupply, 1), -1.4, 1.4);
  const demandPressure = clamp((safeDemand - targetDemand) / Math.max(targetDemand, 1), -1.4, 1.4);

  const supplyMultiplier = 1 + supplyPressure * 0.36;
  const demandMultiplier = 1 + demandPressure * 0.24;
  const rawPrice = basePrice * supplyMultiplier * demandMultiplier;

  const anchorPrice = toPositiveNumber(recentAveragePrice, 0) || basePrice;
  const anchorMin = anchorPrice * 0.8;
  const anchorMax = anchorPrice * 1.2;

  let stabilizedPrice = clamp(rawPrice, anchorMin, anchorMax);
  let circuitBreakerTriggered = rawPrice !== stabilizedPrice;

  const safePreviousPrice = toPositiveNumber(previousPrice, 0);

  if (safePreviousPrice > 0) {
    const lowerStep = safePreviousPrice * 0.88;
    const upperStep = safePreviousPrice * 1.12;
    const stepped = clamp(stabilizedPrice, lowerStep, upperStep);
    if (stepped !== stabilizedPrice) {
      circuitBreakerTriggered = true;
      stabilizedPrice = stepped;
    }
  }

  const absoluteFloor = basePrice * 0.55;
  const absoluteCeil = basePrice * 1.65;
  const boundedPrice = clamp(stabilizedPrice, absoluteFloor, absoluteCeil);
  const unitPrice = Math.max(1, Math.round(boundedPrice));

  return {
    resourceType,
    tier,
    basePrice,
    unitPrice,
    rawPrice: Math.round(rawPrice),
    trend: resolveTrend(basePrice, unitPrice),
    circuitBreakerTriggered,
    supplyQuantity: Math.round(safeSupply),
    demandQuantity: Math.round(safeDemand),
    multipliers: {
      supply: Number(supplyMultiplier.toFixed(4)),
      demand: Number(demandMultiplier.toFixed(4)),
    },
  };
}

function calculateCombatGoldReward({
  monsterGoldMin,
  monsterGoldMax,
  zoneGoldMultiplier = 1,
  streakGoldBonus = 0,
  specialGoldBonus = 0,
  premiumGoldMultiplier = 1,
  randomFn = Math.random,
} = {}) {
  const min = Math.max(0, Math.floor(toPositiveNumber(monsterGoldMin, 0)));
  const max = Math.max(min, Math.floor(toPositiveNumber(monsterGoldMax, min)));
  const roll = clamp(toPositiveNumber(randomFn(), 0), 0, 0.9999999999);
  const rolledBase = min + Math.floor(roll * (max - min + 1));
  const tunedBase = Math.floor(rolledBase * COMBAT_GOLD_SOURCE_MULTIPLIER);

  const grossReward = Math.floor(
    (tunedBase * toPositiveNumber(zoneGoldMultiplier, 1) * (1 + toPositiveNumber(streakGoldBonus, 0)) +
      toPositiveNumber(specialGoldBonus, 0)) *
      toPositiveNumber(premiumGoldMultiplier, 1),
  );

  return {
    rolledBase,
    tunedBase,
    grossReward: Math.max(0, grossReward),
  };
}

function calculateRepairCost({
  grossGoldReward = 0,
  maxHp = 1,
  currentHp = 0,
  level = 1,
  isDefeat = false,
} = {}) {
  const safeMaxHp = Math.max(1, Math.floor(toPositiveNumber(maxHp, 1)));
  const safeCurrentHp = clamp(Math.floor(toPositiveNumber(currentHp, 0)), 0, safeMaxHp);
  const missingHp = safeMaxHp - safeCurrentHp;

  const rewardComponent = Math.floor(toPositiveNumber(grossGoldReward, 0) * 0.2);
  const durabilityComponent = Math.floor(missingHp * 0.45);
  const levelComponent = Math.floor(Math.max(1, Math.floor(toPositiveNumber(level, 1))) * 0.65);

  const baseCost = rewardComponent + durabilityComponent + levelComponent;
  const tunedCost = isDefeat ? Math.floor(baseCost * 1.3) : baseCost;

  return Math.max(0, tunedCost);
}

function calculateDeathPenalty({
  currentGold = 0,
  maxHp = 1,
  currentHp = 0,
  level = 1,
} = {}) {
  const safeGold = Math.max(0, Math.floor(toPositiveNumber(currentGold, 0)));
  if (safeGold === 0) {
    return 0;
  }

  const safeMaxHp = Math.max(1, Math.floor(toPositiveNumber(maxHp, 1)));
  const safeCurrentHp = clamp(Math.floor(toPositiveNumber(currentHp, 0)), 0, safeMaxHp);
  const hpRatio = (safeMaxHp - safeCurrentHp) / safeMaxHp;

  const percentPenalty = Math.floor(safeGold * 0.05);
  const conditionPenalty = Math.floor((Math.max(1, Math.floor(toPositiveNumber(level, 1))) * 4 + 14) * hpRatio);
  const cappedPenalty = Math.floor(safeGold * 0.2);

  return clamp(percentPenalty + conditionPenalty, 0, cappedPenalty);
}

function applyCombatEconomyAdjustments({
  currentGold = 0,
  grossGoldReward = 0,
  maxHp = 1,
  currentHp = 0,
  level = 1,
  isDefeat = false,
} = {}) {
  const safeCurrentGold = Math.max(0, Math.floor(toPositiveNumber(currentGold, 0)));
  const safeGrossGoldReward = Math.max(0, Math.floor(toPositiveNumber(grossGoldReward, 0)));

  const requestedRepair = calculateRepairCost({
    grossGoldReward: safeGrossGoldReward,
    maxHp,
    currentHp,
    level,
    isDefeat,
  });

  const requestedDeathPenalty = isDefeat
    ? calculateDeathPenalty({
      currentGold: safeCurrentGold,
      maxHp,
      currentHp,
      level,
    })
    : 0;

  let wallet = safeCurrentGold + safeGrossGoldReward;

  const repairCap = isDefeat ? wallet : Math.max(0, safeGrossGoldReward - 1);
  const appliedRepair = Math.min(wallet, requestedRepair, repairCap);
  wallet -= appliedRepair;

  const appliedDeathPenalty = Math.min(wallet, requestedDeathPenalty);
  wallet -= appliedDeathPenalty;

  const nextGold = Math.max(0, Math.floor(wallet));

  return {
    grossGoldReward: safeGrossGoldReward,
    requestedRepair,
    appliedRepair,
    requestedDeathPenalty,
    appliedDeathPenalty,
    nextGold,
    netGoldDelta: nextGold - safeCurrentGold,
  };
}

function simulateGoldCirculation({
  days = 14,
  initialGold = 100000,
  activePlayers = 120,
  avgBattlesPerPlayer = 5,
  avgGrossCombatReward = 32,
  combatRepairRate = 0.28,
  defeatRate = 0.12,
  avgDeathPenalty = 38,
  avgTradeValuePerPlayer = 260,
  avgPotionSpendPerPlayer = 90,
} = {}) {
  const safeDays = Math.max(1, Math.floor(toPositiveNumber(days, 14)));
  const timeline = [];

  let totalGold = Math.max(0, Math.floor(toPositiveNumber(initialGold, 100000)));

  for (let day = 1; day <= safeDays; day += 1) {
    const players = Math.max(1, Math.floor(toPositiveNumber(activePlayers, 120)));

    const combatGross = Math.floor(
      players * toPositiveNumber(avgBattlesPerPlayer, 5) * toPositiveNumber(avgGrossCombatReward, 32),
    );
    const combatRepairSink = Math.floor(combatGross * clamp(toPositiveNumber(combatRepairRate, 0.28), 0, 1));
    const deathSink = Math.floor(
      players * clamp(toPositiveNumber(defeatRate, 0.12), 0, 1) * toPositiveNumber(avgDeathPenalty, 38),
    );
    const tradeVolume = Math.floor(players * toPositiveNumber(avgTradeValuePerPlayer, 260));
    const tradeFeeSink = Math.floor(tradeVolume * MARKET_FEE_RATE);
    const consumableSink = Math.floor(players * toPositiveNumber(avgPotionSpendPerPlayer, 90));

    const goldSources = combatGross;
    const goldSinks = combatRepairSink + deathSink + tradeFeeSink + consumableSink;
    const netChange = goldSources - goldSinks;

    totalGold = Math.max(0, totalGold + netChange);

    timeline.push({
      day,
      goldSources,
      goldSinks,
      netChange,
      totalGold,
    });
  }

  const firstTotal = timeline[0]?.totalGold || totalGold;
  const lastTotal = timeline[timeline.length - 1]?.totalGold || totalGold;
  const inflationRate = firstTotal > 0
    ? (lastTotal - firstTotal) / firstTotal
    : 0;

  return {
    config: {
      days: safeDays,
      initialGold,
      activePlayers,
    },
    timeline,
    summary: {
      firstTotal,
      lastTotal,
      inflationRate,
      averageNetPerDay: Math.floor(
        timeline.reduce((sum, point) => sum + point.netChange, 0) / timeline.length,
      ),
    },
  };
}

module.exports = {
  MARKET_FEE_RATE,
  COMBAT_GOLD_SOURCE_MULTIPLIER,
  PRICE_LOOKBACK_HOURS,
  RESOURCE_BASE_PRICE_BY_TIER,
  getResourceBasePrice,
  calculateNpcResourcePrice,
  calculateCombatGoldReward,
  calculateRepairCost,
  calculateDeathPenalty,
  applyCombatEconomyAdjustments,
  simulateGoldCirculation,
};
