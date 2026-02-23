const { getResourceBasePrice } = require('./economy');
const { RESOURCES, RECIPES } = require('./production-classes');

const DYNAMIC_PRICE_ITEM_TYPES = Object.freeze({
  resource: 'resource',
});

const DYNAMIC_PRICE_LOOKBACK_HOURS = 24;
const DYNAMIC_PRICE_CACHE_MINUTES = 5;
const NPC_TRADER_ID = 0;
const NPC_SHOP_SALE_TYPES = Object.freeze({
  consumable: 'consumable',
});

const SUPPLY_OVERFLOW_RATIO = 2.0;
const SUPPLY_SHORTAGE_RATIO = 0.5;
const PRICE_MULTIPLIER_MIN = 0.5;
const PRICE_MULTIPLIER_MAX = 2.0;
const NPC_BUY_RATE = 0.7;
const NPC_SELL_RATE = 1.3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function toSafeRatio(supply24h, demand24h) {
  const safeSupply = toSafeInt(supply24h, 0);
  const safeDemand = toSafeInt(demand24h, 0);
  return safeSupply / Math.max(1, safeDemand);
}

function resolveMarketPressure(supplyDemandRatio) {
  if (supplyDemandRatio > SUPPLY_OVERFLOW_RATIO) {
    return {
      key: 'oversupply',
      label: '과잉 공급',
      emoji: '⚠️',
    };
  }

  if (supplyDemandRatio < SUPPLY_SHORTAGE_RATIO) {
    return {
      key: 'shortage',
      label: '공급 부족',
      emoji: '🔥',
    };
  }

  return {
    key: 'balanced',
    label: '균형',
    emoji: '✅',
  };
}

function resolveTrend(multiplier) {
  if (multiplier >= 1.05) {
    return 'up';
  }

  if (multiplier <= 0.95) {
    return 'down';
  }

  return 'stable';
}

function calculateDynamicPriceMultiplier({ supply24h = 0, demand24h = 0 } = {}) {
  const ratio = toSafeRatio(supply24h, demand24h);
  let multiplier;

  if (ratio > SUPPLY_OVERFLOW_RATIO) {
    multiplier = 0.5 + (1 / ratio);
  } else if (ratio < SUPPLY_SHORTAGE_RATIO) {
    multiplier = 1 + (1 - ratio);
  } else {
    multiplier = 1.0;
  }

  return Number(clamp(multiplier, PRICE_MULTIPLIER_MIN, PRICE_MULTIPLIER_MAX).toFixed(4));
}

function createDynamicPricePayload({
  itemKey,
  basePrice,
  supply24h,
  demand24h,
  now = new Date(),
}) {
  const safeBasePrice = Math.max(1, toSafeInt(basePrice, 1));
  const safeSupply = toSafeInt(supply24h, 0);
  const safeDemand = toSafeInt(demand24h, 0);
  const multiplier = calculateDynamicPriceMultiplier({
    supply24h: safeSupply,
    demand24h: safeDemand,
  });

  const npcBuyPrice = Math.max(1, Math.floor(safeBasePrice * multiplier * NPC_BUY_RATE));
  const npcSellPrice = Math.max(npcBuyPrice + 1, Math.floor(safeBasePrice * multiplier * NPC_SELL_RATE));

  return {
    itemType: DYNAMIC_PRICE_ITEM_TYPES.resource,
    itemKey,
    basePrice: safeBasePrice,
    currentMultiplier: multiplier,
    npcBuyPrice,
    npcSellPrice,
    supply24h: safeSupply,
    demand24h: safeDemand,
    lastUpdated: now,
  };
}

function enrichDynamicPriceRecord(record) {
  if (!record) {
    return null;
  }

  const supplyDemandRatio = toSafeRatio(record.supply24h, record.demand24h);
  const pressure = resolveMarketPressure(supplyDemandRatio);
  const trend = resolveTrend(record.currentMultiplier);

  return {
    ...record,
    supplyDemandRatio,
    pressure,
    trend,
  };
}

function mapNpcShopSalesToResourceDemand(sales) {
  const demandMap = {};
  const rows = Array.isArray(sales) ? sales : [];

  for (const sale of rows) {
    const quantity = toSafeInt(sale?.quantity, 0);

    if (quantity <= 0) {
      continue;
    }

    const recipe = RECIPES[sale.itemKey];

    if (!recipe || !recipe.materials || typeof recipe.materials !== 'object') {
      continue;
    }

    for (const [materialKey, materialAmount] of Object.entries(recipe.materials)) {
      if (!RESOURCES[materialKey]) {
        continue;
      }

      const amountPerItem = toSafeInt(materialAmount, 0);

      if (amountPerItem <= 0) {
        continue;
      }

      demandMap[materialKey] = toSafeInt(demandMap[materialKey], 0) + quantity * amountPerItem;
    }
  }

  return demandMap;
}

async function getNpcShopResourceDemandMap24h(prisma, now = new Date()) {
  if (!prisma?.npcShopSale?.findMany) {
    return {};
  }

  const windowStart = new Date(now.getTime() - DYNAMIC_PRICE_LOOKBACK_HOURS * 60 * 60 * 1000);

  const sales = await prisma.npcShopSale.findMany({
    where: {
      saleType: NPC_SHOP_SALE_TYPES.consumable,
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      itemKey: true,
      quantity: true,
    },
  });

  return mapNpcShopSalesToResourceDemand(sales);
}

async function getResourceMarketStats24h(
  prisma,
  itemKey,
  now = new Date(),
  { npcShopDemandMap = null } = {},
) {
  const windowStart = new Date(now.getTime() - DYNAMIC_PRICE_LOOKBACK_HOURS * 60 * 60 * 1000);

  const [openSellAggregate, openBuyAggregate, recentTrades] = await Promise.all([
    prisma.orderBook.aggregate({
      where: {
        itemType: 'resource',
        itemKey,
        type: 'sell',
        status: 'open',
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.orderBook.aggregate({
      where: {
        itemType: 'resource',
        itemKey,
        type: 'buy',
        status: 'open',
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.tradeHistory.findMany({
      where: {
        itemType: 'resource',
        itemKey,
        createdAt: {
          gte: windowStart,
        },
      },
      select: {
        quantity: true,
        sellerId: true,
        buyerId: true,
      },
    }),
  ]);

  const openSell = toSafeInt(openSellAggregate?._sum?.quantity, 0);
  const openBuy = toSafeInt(openBuyAggregate?._sum?.quantity, 0);

  const tradeRows = Array.isArray(recentTrades) ? recentTrades : [];

  let npcInbound = 0;
  let npcOutbound = 0;
  let playerDemand = 0;
  let totalVolume = 0;
  const npcShopDemand24h = toSafeInt(npcShopDemandMap?.[itemKey], 0);

  for (const trade of tradeRows) {
    const quantity = toSafeInt(trade.quantity, 0);
    if (quantity <= 0) {
      continue;
    }

    totalVolume += quantity;

    if (trade.buyerId === NPC_TRADER_ID) {
      npcInbound += quantity;
      continue;
    }

    if (trade.sellerId === NPC_TRADER_ID) {
      npcOutbound += quantity;
      continue;
    }

    playerDemand += quantity;
  }

  return {
    supply24h: openSell + npcInbound,
    demand24h: openBuy + playerDemand + npcOutbound + npcShopDemand24h,
    npcShopDemand24h,
    volume24h: totalVolume,
    tradeCount24h: tradeRows.length,
  };
}

function isPriceRecordFresh(record, now = new Date(), maxAgeMinutes = DYNAMIC_PRICE_CACHE_MINUTES) {
  if (!record?.lastUpdated) {
    return false;
  }

  const updatedAt = new Date(record.lastUpdated);
  if (Number.isNaN(updatedAt.getTime())) {
    return false;
  }

  const ageMs = now.getTime() - updatedAt.getTime();
  return ageMs <= maxAgeMinutes * 60 * 1000;
}

async function refreshResourceDynamicPrice(
  prisma,
  itemKey,
  now = new Date(),
  { npcShopDemandMap = null } = {},
) {
  if (!RESOURCES[itemKey]) {
    return null;
  }

  const basePrice = getResourceBasePrice(itemKey);
  const marketStats = await getResourceMarketStats24h(prisma, itemKey, now, {
    npcShopDemandMap,
  });
  const payload = createDynamicPricePayload({
    itemKey,
    basePrice,
    supply24h: marketStats.supply24h,
    demand24h: marketStats.demand24h,
    now,
  });

  const record = await prisma.dynamicPrice.upsert({
    where: {
      itemType_itemKey: {
        itemType: DYNAMIC_PRICE_ITEM_TYPES.resource,
        itemKey,
      },
    },
    update: payload,
    create: payload,
  });

  return {
    ...enrichDynamicPriceRecord(record),
    volume24h: marketStats.volume24h,
    tradeCount24h: marketStats.tradeCount24h,
  };
}

async function getResourceDynamicPrice(
  prisma,
  itemKey,
  { forceRefresh = false, now = new Date(), maxAgeMinutes = DYNAMIC_PRICE_CACHE_MINUTES } = {},
) {
  if (!RESOURCES[itemKey]) {
    return null;
  }

  if (!forceRefresh) {
    const record = await prisma.dynamicPrice.findUnique({
      where: {
        itemType_itemKey: {
          itemType: DYNAMIC_PRICE_ITEM_TYPES.resource,
          itemKey,
        },
      },
    });

    if (record && isPriceRecordFresh(record, now, maxAgeMinutes)) {
      return enrichDynamicPriceRecord(record);
    }
  }

  return refreshResourceDynamicPrice(prisma, itemKey, now);
}

async function refreshAllResourceDynamicPrices(prisma, now = new Date()) {
  const resourceKeys = Object.keys(RESOURCES);
  const npcShopDemandMap = await getNpcShopResourceDemandMap24h(prisma, now);
  const results = await Promise.all(
    resourceKeys.map((itemKey) =>
      refreshResourceDynamicPrice(prisma, itemKey, now, {
        npcShopDemandMap,
      })),
  );
  return results.filter(Boolean);
}

function buildResourcePriceSnapshotRows(priceRows, now = new Date()) {
  return (Array.isArray(priceRows) ? priceRows : [])
    .filter((row) => row && RESOURCES[row.itemKey])
    .map((row) => {
      const price = Math.max(1, Math.floor(Number(row.npcBuyPrice) || 0));
      return {
        itemType: DYNAMIC_PRICE_ITEM_TYPES.resource,
        itemKey: row.itemKey,
        avgPrice: price,
        minPrice: price,
        maxPrice: price,
        volume: 0,
        recordedAt: now,
      };
    });
}

async function createResourcePriceSnapshots(prisma, now = new Date()) {
  const refreshed = await refreshAllResourceDynamicPrices(prisma, now);
  const rows = buildResourcePriceSnapshotRows(refreshed, now);

  if (rows.length === 0 || !prisma?.itemPriceHistory?.createMany) {
    return rows;
  }

  await prisma.itemPriceHistory.createMany({
    data: rows,
  });

  return rows;
}

module.exports = {
  DYNAMIC_PRICE_ITEM_TYPES,
  DYNAMIC_PRICE_LOOKBACK_HOURS,
  DYNAMIC_PRICE_CACHE_MINUTES,
  NPC_TRADER_ID,
  NPC_SHOP_SALE_TYPES,
  SUPPLY_OVERFLOW_RATIO,
  SUPPLY_SHORTAGE_RATIO,
  PRICE_MULTIPLIER_MIN,
  PRICE_MULTIPLIER_MAX,
  NPC_BUY_RATE,
  NPC_SELL_RATE,
  calculateDynamicPriceMultiplier,
  createDynamicPricePayload,
  enrichDynamicPriceRecord,
  mapNpcShopSalesToResourceDemand,
  getNpcShopResourceDemandMap24h,
  getResourceMarketStats24h,
  isPriceRecordFresh,
  refreshResourceDynamicPrice,
  refreshAllResourceDynamicPrices,
  getResourceDynamicPrice,
  buildResourcePriceSnapshotRows,
  createResourcePriceSnapshots,
};
