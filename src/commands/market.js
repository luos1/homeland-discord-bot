const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { RESOURCES } = require('../game/production-classes');
const { EQUIPMENT_TYPES, RARITIES } = require('../game/equipment');
const { DAILY_QUEST_EVENTS, recordDailyQuestProgress } = require('../game/daily-quests');
const { logTradePricePoint } = require('../game/economy-monitor');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { buildVillageHomeCustomId } = require('../utils/village');
const {
  handleOnboardingEvent,
  maybeSendGuideTip,
  sendOnboardingFeedback,
} = require('../game/onboarding');
const {
  MARKET_FEE_RATE,
  PRICE_LOOKBACK_HOURS,
  getResourceBasePrice,
  calculateNpcResourcePrice,
} = require('../game/economy');

const MARKET_BUTTON_PREFIX = 'market:';
const MAX_PRICE_PER_UNIT = 100000;
const ORDERBOOK_DEPTH = 5;
const RECENT_TRADE_LIMIT = 5;
const MAX_SELECT_OPTIONS = 25;
const EQUIPMENT_MAX_PRICE = 100000000;
const EQUIPMENT_RARITY_FILTERS = {
  all: { label: '전체', emoji: '📋' },
  common: { label: '일반', emoji: '⚪' },
  rare: { label: '희귀', emoji: '🔵' },
  epic: { label: '영웅', emoji: '🟣' },
  legendary: { label: '전설', emoji: '🟠' },
};
const EQUIPMENT_TYPE_FILTERS = {
  all: { label: '전체', emoji: '📋' },
  weapon: { label: '무기', emoji: '⚔️' },
  armor: { label: '방어구', emoji: '🛡️' },
};
const NPC_TRADER_ID = 0;

function getResourceInfo(itemKey) {
  const resource = RESOURCES[itemKey];

  if (!resource) {
    return {
      key: itemKey,
      name: itemKey,
      emoji: '📦',
      tier: 0,
    };
  }

  return {
    key: itemKey,
    name: resource.name,
    emoji: resource.emoji,
    tier: resource.tier,
  };
}

function formatGold(value) {
  return `${value.toLocaleString('ko-KR')}G`;
}

function truncateLabel(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizeEquipmentCategory(type) {
  return type === 'weapon' ? 'weapon' : 'armor';
}

function normalizeEquipmentFilters(filters = {}) {
  const rarity = filters.rarity || 'all';
  const type = filters.type || 'all';

  return {
    rarity: EQUIPMENT_RARITY_FILTERS[rarity] ? rarity : 'all',
    type: EQUIPMENT_TYPE_FILTERS[type] ? type : 'all',
  };
}

function getEquipmentListingData(listing) {
  if (!listing.itemData || typeof listing.itemData !== 'object') {
    return {};
  }

  return listing.itemData;
}

function createEquipmentSnapshot(equipment) {
  return {
    name: equipment.name,
    type: equipment.type,
    rarity: equipment.rarity,
    attack: equipment.attack,
    defense: equipment.defense,
    hp: equipment.hp,
    mana: equipment.mana,
    effect: equipment.effect,
    upgradeLevel: equipment.upgradeLevel || 0,
  };
}

function buildEquipmentFromSnapshot(snapshot, characterId, fallbackName = '알 수 없는 장비') {
  const toInt = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  };

  return {
    characterId,
    name: snapshot.name || fallbackName,
    type: snapshot.type || 'weapon',
    rarity: snapshot.rarity || 'common',
    attack: toInt(snapshot.attack, 0),
    defense: toInt(snapshot.defense, 0),
    hp: toInt(snapshot.hp, 0),
    mana: toInt(snapshot.mana, 0),
    effect: snapshot.effect || null,
    equipped: false,
    upgradeLevel: toInt(snapshot.upgradeLevel, 0),
  };
}

function formatEquipmentListingLine(listing, index) {
  const data = getEquipmentListingData(listing);
  const rarityData = RARITIES[data.rarity || 'common'] || { emoji: '⚪', name: '일반' };
  const typeData = EQUIPMENT_TYPES[data.type || 'weapon'] || { emoji: '⚔️', name: '장비' };
  const levelSuffix = data.upgradeLevel > 0 ? ` +${data.upgradeLevel}` : '';
  const stats = [
    `⚔️${data.attack || 0}`,
    `🛡️${data.defense || 0}`,
    `❤️${data.hp || 0}`,
    `🔷${data.mana || 0}`,
  ].join(' ');

  return `${index + 1}. ${rarityData.emoji} ${typeData.emoji} **${listing.itemName}${levelSuffix}**\n   ${rarityData.name} | ${typeData.name} | ${formatGold(listing.totalPrice)}\n   ${stats}`;
}

function filterEquipmentListings(listings, filters) {
  return listings.filter((listing) => {
    const data = getEquipmentListingData(listing);
    const rarityMatched = filters.rarity === 'all' || data.rarity === filters.rarity;
    const typeMatched =
      filters.type === 'all' ||
      normalizeEquipmentCategory(data.type || 'weapon') === filters.type;

    return rarityMatched && typeMatched;
  });
}

function createEquipmentMarketEmbed(listings, filters) {
  const rarity = EQUIPMENT_RARITY_FILTERS[filters.rarity];
  const type = EQUIPMENT_TYPE_FILTERS[filters.type];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('⚔️ 장비 거래소')
    .setDescription(
      [
        createDivider(),
        `📊 등록 수: ${listings.length}개`,
        `🔎 등급: ${rarity.emoji} ${rarity.label}`,
        `🔎 타입: ${type.emoji} ${type.label}`,
        '',
        listings.length > 0
          ? listings.map((listing, index) => formatEquipmentListingLine(listing, index)).join('\n\n')
          : '조건에 맞는 장비가 없습니다',
        '',
        createDivider(),
        '',
        '💡 구매하려면 장비를 선택하세요',
        '💡 판매하려면 "등록" 버튼을 누르세요',
      ].join('\n'),
    )
    .setFooter({
      text: `거래 수수료 ${Math.round(MARKET_FEE_RATE * 100)}% (판매자 부담)`,
    });
}

function createEquipmentMarketActionRows(listings, filters) {
  const rows = [];
  const buyOptions = listings.slice(0, MAX_SELECT_OPTIONS).map((listing) => {
    const data = getEquipmentListingData(listing);
    const rarityData = RARITIES[data.rarity || 'common'] || { emoji: '⚪', name: '일반' };
    const typeData = EQUIPMENT_TYPES[data.type || 'weapon'] || { name: '장비' };
    const levelSuffix = data.upgradeLevel > 0 ? ` +${data.upgradeLevel}` : '';

    return {
      value: `${listing.id}`,
      label: truncateLabel(`${listing.itemName}${levelSuffix}`),
      description: truncateLabel(`${rarityData.name} ${typeData.name} | ${formatGold(listing.totalPrice)}`),
      emoji: rarityData.emoji,
    };
  });

  if (buyOptions.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${MARKET_BUTTON_PREFIX}equipmentbuy`)
          .setPlaceholder('구매할 장비를 선택하세요')
          .addOptions(buyOptions),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}eqfilterrarity:${filters.type}`)
        .setPlaceholder('등급 필터')
        .addOptions(
          Object.entries(EQUIPMENT_RARITY_FILTERS).map(([value, info]) => ({
            value,
            label: info.label,
            emoji: info.emoji,
            default: value === filters.rarity,
          })),
        ),
    ),
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}eqfiltertype:${filters.rarity}`)
        .setPlaceholder('타입 필터')
        .addOptions(
          Object.entries(EQUIPMENT_TYPE_FILTERS).map(([value, info]) => ({
            value,
            label: info.label,
            emoji: info.emoji,
            default: value === filters.type,
          })),
        ),
    ),
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}equipmentsell`)
        .setLabel('등록')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}back`)
        .setLabel('뒤로')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

async function renderEquipmentMarket(interaction, prisma, filters = {}) {
  const normalizedFilters = normalizeEquipmentFilters(filters);
  const activeListings = await prisma.marketListing.findMany({
    where: {
      itemType: 'equipment',
      status: 'active',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  const filtered = filterEquipmentListings(activeListings, normalizedFilters);

  await interaction.update({
    embeds: [createEquipmentMarketEmbed(filtered, normalizedFilters)],
    components: createEquipmentMarketActionRows(filtered, normalizedFilters),
  });
}

function formatTrendLabel(trend) {
  if (trend === 'up') {
    return '📈 상승';
  }

  if (trend === 'down') {
    return '📉 하락';
  }

  return '➖ 안정';
}

function createMarketMainEmbed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🏪 거래소')
    .setDescription(
      [
        createDivider(),
        '**양방향 주문장 거래소**',
        '',
        '📉 자원 매도/매수: 동일 가격 주문 자동 체결',
        '⚔️ 장비 거래: 등록 후 즉시 구매 방식',
        '',
        `💰 체결 수수료: ${Math.round(MARKET_FEE_RATE * 100)}% (판매자 부담)`,
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '자원 주문장 / 장비 거래소를 선택하세요',
    });
}

function createMarketMainActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MARKET_BUTTON_PREFIX}resources`)
      .setLabel('자원 거래소')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${MARKET_BUTTON_PREFIX}equipment`)
      .setLabel('장비 거래소')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${MARKET_BUTTON_PREFIX}myorders`)
      .setLabel('내 주문')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildVillageHomeCustomId())
      .setLabel('마을')
      .setEmoji('🏘️')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildResourceSelectOptions() {
  return Object.entries(RESOURCES)
    .map(([key, resource]) => ({
      value: key,
      label: resource.name,
      emoji: resource.emoji,
      tier: resource.tier || 0,
    }))
    .sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }

      return a.label.localeCompare(b.label, 'ko-KR');
    })
    .slice(0, MAX_SELECT_OPTIONS)
    .map((option) => ({
      value: option.value,
      label: option.label,
      emoji: option.emoji,
      description: `티어 ${option.tier} 자원`,
    }));
}

function createResourceSelectionEmbed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('📦 자원 거래소')
    .setDescription(
      [
        createDivider(),
        '호가창을 볼 자원을 선택하세요.',
        '',
        '🟥 매도 호가 / 🟩 매수 호가',
        '📌 최저 매도 / 최고 매수',
        '🕒 최근 체결 내역',
        '🏛️ NPC 동적 매입가(실시간, 수급 기반)',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({ text: '선택한 자원 기준으로 주문 등록이 진행됩니다' });
}

function createResourceSelectionActionRows() {
  const options = buildResourceSelectOptions();

  const rows = [];

  if (options.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${MARKET_BUTTON_PREFIX}select:resource`)
          .setPlaceholder('호가창을 확인할 자원을 선택하세요')
          .addOptions(options),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}back`)
        .setLabel('뒤로')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

function aggregateOrderLevels(orders) {
  const levels = [];
  const seenByPrice = new Map();

  for (const order of orders) {
    if (seenByPrice.has(order.price)) {
      const index = seenByPrice.get(order.price);
      levels[index].quantity += order.quantity;
      continue;
    }

    seenByPrice.set(order.price, levels.length);
    levels.push({
      price: order.price,
      quantity: order.quantity,
    });
  }

  return levels;
}

function formatOrderLevels(levels, emptyMessage) {
  if (!levels || levels.length === 0) {
    return emptyMessage;
  }

  return levels
    .slice(0, ORDERBOOK_DEPTH)
    .map((level, index) => `${index + 1}. ${formatGold(level.price)} · ${level.quantity}개`)
    .join('\n');
}

function formatTradeTime(createdAt) {
  const date = new Date(createdAt);
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatRecentTrades(trades) {
  if (!trades || trades.length === 0) {
    return '체결 내역이 없습니다';
  }

  return trades
    .map((trade) => {
      const unitPrice = trade.quantity > 0 ? Math.floor(trade.price / trade.quantity) : trade.price;
      return `${formatTradeTime(trade.createdAt)} | ${formatGold(unitPrice)} · ${trade.quantity}개`;
    })
    .join('\n');
}

function createOrderBookEmbed(itemKey, snapshot) {
  const resource = getResourceInfo(itemKey);
  const bestAsk = snapshot.sellLevels[0]?.price ?? null;
  const bestBid = snapshot.buyLevels[0]?.price ?? null;
  const npcPrice = snapshot.npcPrice || {
    unitPrice: getResourceBasePrice(itemKey),
    trend: 'stable',
    circuitBreakerTriggered: false,
    supplyQuantity: 0,
    demandQuantity: 0,
  };

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`${resource.emoji} ${resource.name} 호가창`)
    .setDescription(
      [
        createDivider(),
        `🟥 최저 매도: ${bestAsk ? formatGold(bestAsk) : '없음'}`,
        `🟩 최고 매수: ${bestBid ? formatGold(bestBid) : '없음'}`,
        '',
        '🟥 **매도 호가**',
        formatOrderLevels(snapshot.sellLevels, '매도 주문이 없습니다'),
        '',
        '🟩 **매수 호가**',
        formatOrderLevels(snapshot.buyLevels, '매수 주문이 없습니다'),
        '',
        '🕒 **최근 체결**',
        formatRecentTrades(snapshot.recentTrades),
        '',
        '🏛️ **NPC 즉시 매입 (동적가)**',
        `${formatGold(npcPrice.unitPrice)}/개 · ${formatTrendLabel(npcPrice.trend)}`,
        `공급 ${npcPrice.supplyQuantity} / 수요 ${npcPrice.demandQuantity}`,
        npcPrice.circuitBreakerTriggered ? '🛑 서킷브레이커 발동(급변동 완화)' : '✅ 서킷브레이커 정상',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '매도/매수 등록 후 가격이 일치하면 자동 체결됩니다',
    });
}

function createOrderBookActionRows(itemKey) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}place:sell:${itemKey}`)
        .setLabel('매도 등록')
        .setEmoji('📉')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}place:buy:${itemKey}`)
        .setLabel('매수 등록')
        .setEmoji('📈')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}npcsell:${itemKey}`)
        .setLabel('NPC 즉시 매입')
        .setEmoji('🏛️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}book:${itemKey}`)
        .setLabel('새로고침')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}myorders`)
        .setLabel('내 주문')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}resources`)
        .setLabel('자원 선택')
        .setEmoji('🗂️')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function formatOrderTypeLabel(type) {
  return type === 'buy' ? '매수' : '매도';
}

function createMyOrdersEmbed(orders) {
  const lines = orders.map((order, index) => {
    const resource = getResourceInfo(order.itemKey);
    const orderValue = order.quantity * order.price;

    return `${index + 1}. ${resource.emoji} [${formatOrderTypeLabel(order.type)}] **${order.itemName}**\n   ${order.quantity}개 @ ${formatGold(order.price)} (총 ${formatGold(orderValue)})`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('📊 내 주문')
    .setDescription(
      [
        createDivider(),
        `열린 주문: ${orders.length}개`,
        '',
        lines.length > 0 ? lines.join('\n\n') : '현재 열린 주문이 없습니다',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '취소하면 미체결 잔량이 복구됩니다',
    });
}

function createMyOrdersActionRows(orders) {
  const rows = [];

  if (orders.length > 0) {
    const options = orders.slice(0, MAX_SELECT_OPTIONS).map((order) => {
      const resource = getResourceInfo(order.itemKey);
      const orderValue = order.quantity * order.price;

      return {
        value: `${order.id}`,
        label: `[${formatOrderTypeLabel(order.type)}] ${order.itemName} x${order.quantity}`,
        description: `@${formatGold(order.price)} / 총 ${formatGold(orderValue)}`,
        emoji: resource.emoji,
      };
    });

    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${MARKET_BUTTON_PREFIX}cancel:order`)
          .setPlaceholder('취소할 주문을 선택하세요')
          .addOptions(options),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}resources`)
        .setLabel('자원 거래소')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}back`)
        .setLabel('뒤로')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

function parsePositiveInteger(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function fetchOrderBookSnapshot(prisma, itemKey) {
  const priceWindowStart = new Date(Date.now() - PRICE_LOOKBACK_HOURS * 60 * 60 * 1000);
  const [sellOrders, buyOrders, recentTrades, pricingWindowTrades] = await Promise.all([
    prisma.orderBook.findMany({
      where: {
        itemType: 'resource',
        itemKey,
        type: 'sell',
        status: 'open',
      },
      orderBy: [
        { price: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 100,
    }),
    prisma.orderBook.findMany({
      where: {
        itemType: 'resource',
        itemKey,
        type: 'buy',
        status: 'open',
      },
      orderBy: [
        { price: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 100,
    }),
    prisma.tradeHistory.findMany({
      where: {
        itemType: 'resource',
        itemKey,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: RECENT_TRADE_LIMIT,
    }),
    prisma.tradeHistory.findMany({
      where: {
        itemType: 'resource',
        itemKey,
        createdAt: {
          gte: priceWindowStart,
        },
      },
      select: {
        quantity: true,
        price: true,
        buyerId: true,
        sellerId: true,
      },
    }),
  ]);

  const recentTradeRows = Array.isArray(recentTrades) ? recentTrades : [];
  const sellRows = Array.isArray(sellOrders) ? sellOrders : [];
  const buyRows = Array.isArray(buyOrders) ? buyOrders : [];
  const pricedTrades = Array.isArray(pricingWindowTrades) ? pricingWindowTrades : [];

  let recentAveragePrice = 0;
  let totalTradeQuantity = 0;
  let weightedTradePrice = 0;
  let npcInboundSupply = 0;
  let npcOutboundDemand = 0;
  let playerDemand = 0;

  pricedTrades.forEach((trade) => {
    const quantity = Number.isFinite(trade.quantity) ? Math.max(0, trade.quantity) : 0;
    const totalPrice = Number.isFinite(trade.price) ? Math.max(0, trade.price) : 0;

    if (quantity <= 0 || totalPrice <= 0) {
      return;
    }

    totalTradeQuantity += quantity;
    weightedTradePrice += totalPrice;

    if (trade.buyerId === NPC_TRADER_ID) {
      npcInboundSupply += quantity;
      return;
    }

    if (trade.sellerId === NPC_TRADER_ID) {
      npcOutboundDemand += quantity;
      return;
    }

    playerDemand += quantity;
  });

  if (totalTradeQuantity > 0) {
    recentAveragePrice = Math.round(weightedTradePrice / totalTradeQuantity);
  }

  const openSellSupply = sellRows.reduce((sum, order) => sum + Math.max(0, order.quantity || 0), 0);
  const openBuyDemand = buyRows.reduce((sum, order) => sum + Math.max(0, order.quantity || 0), 0);

  const npcPrice = calculateNpcResourcePrice({
    resourceType: itemKey,
    supplyQuantity: openSellSupply + npcInboundSupply,
    demandQuantity: openBuyDemand + playerDemand + npcOutboundDemand,
    recentAveragePrice,
  });

  return {
    sellLevels: aggregateOrderLevels(sellRows).slice(0, ORDERBOOK_DEPTH),
    buyLevels: aggregateOrderLevels(buyRows).slice(0, ORDERBOOK_DEPTH),
    recentTrades: recentTradeRows,
    npcPrice,
  };
}

async function addResourceToCharacter(tx, { characterId, itemKey, itemName, quantity }) {
  await tx.resource.upsert({
    where: {
      characterId_type: {
        characterId,
        type: itemKey,
      },
    },
    update: {
      quantity: {
        increment: quantity,
      },
    },
    create: {
      characterId,
      type: itemKey,
      name: itemName,
      quantity,
    },
  });
}

async function placeOrderWithMatching({ prisma, character, side, itemKey, quantity, price }) {
  const resource = getResourceInfo(itemKey);
  const reserveAmount = quantity * price;

  return prisma.$transaction(async (tx) => {
    if (side === 'sell') {
      const inventory = await tx.resource.findUnique({
        where: {
          characterId_type: {
            characterId: character.id,
            type: itemKey,
          },
        },
      });

      if (!inventory || inventory.quantity < quantity) {
        throw new Error('INSUFFICIENT_RESOURCE');
      }

      await tx.resource.update({
        where: { id: inventory.id },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });
    }

    if (side === 'buy') {
      const freshBuyer = await tx.character.findUnique({
        where: { id: character.id },
        select: {
          gold: true,
        },
      });

      if (!freshBuyer || freshBuyer.gold < reserveAmount) {
        throw new Error('INSUFFICIENT_GOLD');
      }

      await tx.character.update({
        where: { id: character.id },
        data: {
          gold: {
            decrement: reserveAmount,
          },
        },
      });
    }

    const createdOrder = await tx.orderBook.create({
      data: {
        type: side,
        itemType: 'resource',
        itemKey,
        itemName: resource.name,
        price,
        quantity,
        userId: character.userId,
        characterId: character.id,
        status: 'open',
      },
    });

    const matchedTrades = [];
    const matchedCharacterIds = new Set();
    let remainingQuantity = quantity;

    while (remainingQuantity > 0) {
      const oppositeType = side === 'sell' ? 'buy' : 'sell';
      const oppositeOrder = await tx.orderBook.findFirst({
        where: {
          itemType: 'resource',
          itemKey,
          type: oppositeType,
          status: 'open',
          price,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (!oppositeOrder) {
        break;
      }

      const now = new Date();
      const matchedQuantity = Math.min(remainingQuantity, oppositeOrder.quantity);
      const tradedGold = matchedQuantity * price;
      const fee = Math.floor(tradedGold * MARKET_FEE_RATE);
      const sellerNet = tradedGold - fee;

      const buyerId = side === 'buy' ? character.id : oppositeOrder.characterId;
      const sellerId = side === 'sell' ? character.id : oppositeOrder.characterId;

      await tx.character.update({
        where: {
          id: sellerId,
        },
        data: {
          gold: {
            increment: sellerNet,
          },
          tradeVolume: {
            increment: tradedGold,
          },
        },
      });

      await tx.character.update({
        where: {
          id: buyerId,
        },
        data: {
          tradeVolume: {
            increment: tradedGold,
          },
        },
      });

      await addResourceToCharacter(tx, {
        characterId: buyerId,
        itemKey,
        itemName: resource.name,
        quantity: matchedQuantity,
      });

      const oppositeRemaining = oppositeOrder.quantity - matchedQuantity;

      await tx.orderBook.update({
        where: {
          id: oppositeOrder.id,
        },
        data: {
          quantity: oppositeRemaining,
          status: oppositeRemaining > 0 ? 'open' : 'filled',
          filledAt: oppositeRemaining > 0 ? null : now,
        },
      });

      remainingQuantity -= matchedQuantity;

      await tx.orderBook.update({
        where: {
          id: createdOrder.id,
        },
        data: {
          quantity: remainingQuantity,
          status: remainingQuantity > 0 ? 'open' : 'filled',
          filledAt: remainingQuantity > 0 ? null : now,
        },
      });

      const tradeRecord = await tx.tradeHistory.create({
        data: {
          sellerId,
          buyerId,
          itemType: 'resource',
          itemKey,
          itemName: resource.name,
          quantity: matchedQuantity,
          price: tradedGold,
          fee,
        },
      });
      await logTradePricePoint(tx, tradeRecord);

      await tx.rankingEvent.createMany({
        data: [
          {
            characterId: sellerId,
            category: 'trade_volume',
            value: tradedGold,
          },
          {
            characterId: buyerId,
            category: 'trade_volume',
            value: tradedGold,
          },
        ],
      });

      matchedTrades.push({
        quantity: matchedQuantity,
        tradedGold,
        fee,
      });
      matchedCharacterIds.add(sellerId);
      matchedCharacterIds.add(buyerId);
    }

    const order = await tx.orderBook.findUnique({
      where: {
        id: createdOrder.id,
      },
    });

    const matchedQuantity = matchedTrades.reduce((sum, trade) => sum + trade.quantity, 0);
    const matchedGold = matchedTrades.reduce((sum, trade) => sum + trade.tradedGold, 0);
    const matchedFee = matchedTrades.reduce((sum, trade) => sum + trade.fee, 0);

    return {
      order: order || {
        ...createdOrder,
        quantity: remainingQuantity,
        status: remainingQuantity > 0 ? 'open' : 'filled',
      },
      reserveAmount,
      matchedQuantity,
      matchedGold,
      matchedFee,
      matchedCharacterIds: [...matchedCharacterIds],
    };
  });
}

async function cancelOrder({ prisma, characterId, orderId }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.orderBook.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order || order.characterId !== characterId || order.status !== 'open') {
      throw new Error('ORDER_NOT_CANCELABLE');
    }

    let refundedGold = 0;

    if (order.type === 'buy') {
      refundedGold = order.quantity * order.price;

      await tx.character.update({
        where: {
          id: characterId,
        },
        data: {
          gold: {
            increment: refundedGold,
          },
        },
      });
    }

    if (order.type === 'sell') {
      await addResourceToCharacter(tx, {
        characterId,
        itemKey: order.itemKey,
        itemName: order.itemName,
        quantity: order.quantity,
      });
    }

    const cancelledOrder = await tx.orderBook.update({
      where: {
        id: orderId,
      },
      data: {
        status: 'cancelled',
      },
    });

    return {
      order: cancelledOrder,
      refundedGold,
    };
  });
}

function createOrderModal({ side, itemKey, quantityLabel, title }) {
  const modal = new ModalBuilder()
    .setCustomId(`${MARKET_BUTTON_PREFIX}ordermodal:${side}:${itemKey}`)
    .setTitle(title);

  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel(quantityLabel)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  const priceInput = new TextInputBuilder()
    .setCustomId('price')
    .setLabel('개당 가격 (골드)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('100')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantityInput),
    new ActionRowBuilder().addComponents(priceInput),
  );

  return modal;
}

function createNpcSellModal({ itemKey, quantityLabel, title }) {
  const modal = new ModalBuilder()
    .setCustomId(`${MARKET_BUTTON_PREFIX}npcmodal:${itemKey}`)
    .setTitle(title);

  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel(quantityLabel)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));

  return modal;
}

async function getCharacterForMarket(prisma, userId, includeOptions = false) {
  const includeResources =
    typeof includeOptions === 'boolean'
      ? includeOptions
      : Boolean(includeOptions?.includeResources);
  const includeEquipment =
    typeof includeOptions === 'object' ? Boolean(includeOptions?.includeEquipment) : false;

  return prisma.character.findUnique({
    where: {
      userId,
    },
    include: {
      resources: includeResources,
      equipment: includeEquipment,
    },
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('플레이어 주문장 거래소를 이용합니다'),

  async execute(interaction, { prisma }) {
    const character = await getCharacterForMarket(prisma, interaction.user.id);

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createMarketMainEmbed()],
      components: [createMarketMainActionRow()],
    });

    await maybeSendGuideTip({
      prisma,
      user: interaction.user,
      interaction,
      category: 'trade',
    });
  },

  async handleMarketButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(MARKET_BUTTON_PREFIX.length);
    const [action, param1, param2] = customId.split(':');

    if (action === 'back') {
      await interaction.update({
        embeds: [createMarketMainEmbed()],
        components: [createMarketMainActionRow()],
      });
      return true;
    }

    if (action === 'equipment') {
      await renderEquipmentMarket(interaction, prisma);
      return true;
    }

    if (action === 'equipmentsell') {
      const character = await getCharacterForMarket(prisma, interaction.user.id, {
        includeEquipment: true,
      });

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const sellable = character.equipment.filter((equipment) => !equipment.equipped);

      if (sellable.length === 0) {
        await interaction.reply({
          content: '❌ 판매할 장비가 없습니다. (장착 중인 장비는 등록 불가)',
          ephemeral: true,
        });
        return true;
      }

      const options = sellable.slice(0, MAX_SELECT_OPTIONS).map((equipment) => {
        const rarityData = RARITIES[equipment.rarity] || { emoji: '⚪', name: '일반' };
        const typeData = EQUIPMENT_TYPES[equipment.type] || { name: '장비' };
        const levelSuffix = equipment.upgradeLevel > 0 ? ` +${equipment.upgradeLevel}` : '';

        return {
          value: `${equipment.id}`,
          label: truncateLabel(`${equipment.name}${levelSuffix}`),
          description: truncateLabel(`${rarityData.name} ${typeData.name}`),
          emoji: rarityData.emoji,
        };
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLORS.profile)
            .setTitle('💰 장비 판매 등록')
            .setDescription(
              [
                createDivider(),
                '판매할 장비를 선택하세요.',
                '',
                '⚠️ 장착 중인 장비는 등록할 수 없습니다',
                '🧷 등록 시 장비는 판매 완료/취소 전까지 보관됩니다',
                '',
                createDivider(),
              ].join('\n'),
            ),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${MARKET_BUTTON_PREFIX}equipmentsellselect`)
              .setPlaceholder('판매할 장비를 선택하세요')
              .addOptions(options),
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${MARKET_BUTTON_PREFIX}equipment`)
              .setLabel('뒤로')
              .setEmoji('🔙')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return true;
    }

    if (action === 'resources') {
      await interaction.update({
        embeds: [createResourceSelectionEmbed()],
        components: createResourceSelectionActionRows(),
      });
      return true;
    }

    if (action === 'book') {
      const itemKey = param1;
      const resource = RESOURCES[itemKey];

      if (!resource) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const snapshot = await fetchOrderBookSnapshot(prisma, itemKey);

      await interaction.update({
        embeds: [createOrderBookEmbed(itemKey, snapshot)],
        components: createOrderBookActionRows(itemKey),
      });
      return true;
    }

    if (action === 'myorders') {
      const character = await getCharacterForMarket(prisma, interaction.user.id);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const orders = await prisma.orderBook.findMany({
        where: {
          characterId: character.id,
          itemType: 'resource',
          status: 'open',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: MAX_SELECT_OPTIONS,
      });

      await interaction.update({
        embeds: [createMyOrdersEmbed(orders)],
        components: createMyOrdersActionRows(orders),
      });
      return true;
    }

    if (action === 'place') {
      const side = param1;
      const itemKey = param2;
      const resource = getResourceInfo(itemKey);

      if (!['sell', 'buy'].includes(side) || !RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 주문 요청입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id, side === 'sell');

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (side === 'sell') {
        const owned = character.resources.find((entry) => entry.type === itemKey);

        if (!owned || owned.quantity <= 0) {
          await interaction.reply({
            content: `❌ ${resource.name} 보유 수량이 부족합니다.`,
            ephemeral: true,
          });
          return true;
        }

        const modal = createOrderModal({
          side,
          itemKey,
          quantityLabel: `매도 수량 (최대 ${owned.quantity}개)`,
          title: `${resource.name} 매도 등록`,
        });

        await interaction.showModal(modal);
        return true;
      }

      const modal = createOrderModal({
        side,
        itemKey,
        quantityLabel: '매수 수량',
        title: `${resource.name} 매수 등록`,
      });

      await interaction.showModal(modal);
      return true;
    }

    if (action === 'npcsell') {
      const itemKey = param1;
      const resource = getResourceInfo(itemKey);

      if (!RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id, true);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const owned = character.resources.find((entry) => entry.type === itemKey);

      if (!owned || owned.quantity <= 0) {
        await interaction.reply({
          content: `❌ ${resource.name} 보유 수량이 부족합니다.`,
          ephemeral: true,
        });
        return true;
      }

      const snapshot = await fetchOrderBookSnapshot(prisma, itemKey);
      const modal = createNpcSellModal({
        itemKey,
        quantityLabel: `NPC 즉시 매입 수량 (최대 ${owned.quantity}개)`,
        title: `${resource.name} NPC 매입 (${formatGold(snapshot.npcPrice.unitPrice)}/개)`,
      });

      await interaction.showModal(modal);
      return true;
    }

    return false;
  },

  async handleMarketSelect(interaction, { prisma }) {
    if (!interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(MARKET_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');
    const selectedValue = interaction.values[0];

    if (action === 'eqfilterrarity') {
      await renderEquipmentMarket(interaction, prisma, {
        rarity: selectedValue,
        type: param,
      });
      return true;
    }

    if (action === 'eqfiltertype') {
      await renderEquipmentMarket(interaction, prisma, {
        rarity: param,
        type: selectedValue,
      });
      return true;
    }

    if (action === 'equipmentsellselect') {
      const equipmentId = Number.parseInt(selectedValue, 10);

      if (!Number.isInteger(equipmentId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 장비입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id, {
        includeEquipment: true,
      });

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const equipment = character.equipment.find((entry) => entry.id === equipmentId);

      if (!equipment) {
        await interaction.reply({
          content: '❌ 해당 장비를 보유하고 있지 않습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (equipment.equipped) {
        await interaction.reply({
          content: '⚠️ 장착 중인 장비는 판매할 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}equipmentmodal:${equipment.id}`)
        .setTitle(`${equipment.name} 판매 등록`);

      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('판매 가격 (골드)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1000')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(priceInput));

      await interaction.showModal(modal);
      return true;
    }

    if (action === 'equipmentbuy') {
      const listingId = Number.parseInt(selectedValue, 10);

      if (!Number.isInteger(listingId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 거래소 상품입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const listing = await prisma.marketListing.findUnique({
        where: {
          id: listingId,
        },
      });

      if (!listing || listing.status !== 'active' || listing.itemType !== 'equipment') {
        await interaction.reply({
          content: '❌ 이미 판매된 상품이거나 존재하지 않습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (listing.sellerId === character.id) {
        await interaction.reply({
          content: '❌ 자신이 등록한 장비는 구매할 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const totalPrice = listing.totalPrice || listing.pricePerUnit * listing.quantity;

      if (character.gold < totalPrice) {
        await interaction.reply({
          content: `❌ 골드가 부족합니다. (필요: ${formatGold(totalPrice)}, 보유: ${formatGold(character.gold)})`,
          ephemeral: true,
        });
        return true;
      }

      const fee = Math.floor(totalPrice * MARKET_FEE_RATE);
      const sellerNet = totalPrice - fee;

      try {
        await prisma.$transaction(async (tx) => {
          const freshListing = await tx.marketListing.findUnique({
            where: { id: listingId },
          });

          if (!freshListing || freshListing.status !== 'active' || freshListing.itemType !== 'equipment') {
            throw new Error('LISTING_UNAVAILABLE');
          }

          if (freshListing.sellerId === character.id) {
            throw new Error('SELF_PURCHASE');
          }

          const debit = await tx.character.updateMany({
            where: {
              id: character.id,
              gold: {
                gte: totalPrice,
              },
            },
            data: {
              gold: {
                decrement: totalPrice,
              },
              tradeVolume: {
                increment: totalPrice,
              },
            },
          });

          if (debit.count === 0) {
            throw new Error('INSUFFICIENT_GOLD');
          }

          await tx.character.update({
            where: {
              id: freshListing.sellerId,
            },
            data: {
              gold: {
                increment: sellerNet,
              },
              tradeVolume: {
                increment: totalPrice,
              },
            },
          });

          await tx.equipment.create({
            data: buildEquipmentFromSnapshot(
              getEquipmentListingData(freshListing),
              character.id,
              freshListing.itemName,
            ),
          });

          await tx.marketListing.update({
            where: {
              id: listingId,
            },
            data: {
              status: 'sold',
              soldAt: new Date(),
              buyerId: character.id,
            },
          });

          const tradeRecord = await tx.tradeHistory.create({
            data: {
              sellerId: freshListing.sellerId,
              buyerId: character.id,
              itemType: freshListing.itemType,
              itemKey: freshListing.itemKey,
              itemName: freshListing.itemName,
              quantity: freshListing.quantity,
              price: totalPrice,
              fee,
            },
          });
          await logTradePricePoint(tx, tradeRecord);

          await tx.rankingEvent.createMany({
            data: [
              {
                characterId: freshListing.sellerId,
                category: 'trade_volume',
                value: totalPrice,
              },
              {
                characterId: character.id,
                category: 'trade_volume',
                value: totalPrice,
              },
            ],
          });
        });
      } catch (error) {
        if (error.message === 'LISTING_UNAVAILABLE') {
          await interaction.reply({
            content: '❌ 이미 판매된 상품입니다.',
            ephemeral: true,
          });
          return true;
        }

        if (error.message === 'SELF_PURCHASE') {
          await interaction.reply({
            content: '❌ 자신이 등록한 장비는 구매할 수 없습니다.',
            ephemeral: true,
          });
          return true;
        }

        if (error.message === 'INSUFFICIENT_GOLD') {
          await interaction.reply({
            content: '❌ 골드가 부족합니다. 잔액을 확인해주세요.',
            ephemeral: true,
          });
          return true;
        }

        throw error;
      }

      try {
        await Promise.all([
          recordDailyQuestProgress(prisma, character.id, DAILY_QUEST_EVENTS.MARKET_TRADE, 1),
          recordDailyQuestProgress(prisma, listing.sellerId, DAILY_QUEST_EVENTS.MARKET_TRADE, 1),
        ]);
      } catch (error) {
        console.error('Daily quest progress update failed (equipment market trade):', error);
      }

      const listingData = getEquipmentListingData(listing);
      const rarityData = RARITIES[listingData.rarity || 'common'] || { emoji: '⚪', name: '일반' };
      const typeData = EQUIPMENT_TYPES[listingData.type || 'weapon'] || { name: '장비' };
      const levelSuffix = listingData.upgradeLevel > 0 ? ` +${listingData.upgradeLevel}` : '';

      await interaction.reply({
        content: [
          '✅ 구매 완료!',
          '',
          `${rarityData.emoji} **${listing.itemName}${levelSuffix}**`,
          `🧩 ${rarityData.name} ${typeData.name}`,
          `💰 ${formatGold(totalPrice)} 지불`,
          `💵 남은 골드: ${formatGold(character.gold - totalPrice)}`,
        ].join('\n'),
        ephemeral: true,
      });

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: 'trade_action',
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);

      return true;
    }

    if (action === 'select' && param === 'resource') {
      const itemKey = selectedValue;

      if (!RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const snapshot = await fetchOrderBookSnapshot(prisma, itemKey);

      await interaction.update({
        embeds: [createOrderBookEmbed(itemKey, snapshot)],
        components: createOrderBookActionRows(itemKey),
      });
      return true;
    }

    if (action === 'cancel' && param === 'order') {
      const orderId = Number.parseInt(selectedValue, 10);

      if (!Number.isInteger(orderId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 주문 번호입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      let cancelled;

      try {
        cancelled = await cancelOrder({
          prisma,
          characterId: character.id,
          orderId,
        });
      } catch (error) {
        if (error.message === 'ORDER_NOT_CANCELABLE') {
          await interaction.reply({
            content: '❌ 취소할 수 없는 주문입니다.',
            ephemeral: true,
          });
          return true;
        }

        throw error;
      }

      const latestOrders = await prisma.orderBook.findMany({
        where: {
          characterId: character.id,
          itemType: 'resource',
          status: 'open',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: MAX_SELECT_OPTIONS,
      });

      await interaction.update({
        embeds: [createMyOrdersEmbed(latestOrders)],
        components: createMyOrdersActionRows(latestOrders),
      });

      const restoredText = cancelled.order.type === 'buy'
        ? `환불 ${formatGold(cancelled.refundedGold)}`
        : `자원 ${cancelled.order.quantity}개 복구`;

      await interaction.followUp({
        content: `✅ ${formatOrderTypeLabel(cancelled.order.type)} 주문 취소 완료 (${restoredText})`,
        ephemeral: true,
      });

      return true;
    }

    return false;
  },

  async handleMarketModal(interaction, { prisma }) {
    if (!interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(MARKET_BUTTON_PREFIX.length);
    const [action, param1, param2] = customId.split(':');

    if (action === 'equipmentmodal') {
      const equipmentId = Number.parseInt(param1, 10);

      if (!Number.isInteger(equipmentId)) {
        await interaction.reply({
          content: '❌ 유효하지 않은 장비입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id, {
        includeEquipment: true,
      });

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const equipment = character.equipment.find((entry) => entry.id === equipmentId);

      if (!equipment) {
        await interaction.reply({
          content: '❌ 해당 장비를 보유하고 있지 않습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (equipment.equipped) {
        await interaction.reply({
          content: '⚠️ 장착 중인 장비는 판매할 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const pricePerUnit = parsePositiveInteger(interaction.fields.getTextInputValue('price'));

      if (!pricePerUnit) {
        await interaction.reply({
          content: '❌ 유효한 가격을 입력하세요.',
          ephemeral: true,
        });
        return true;
      }

      if (pricePerUnit > EQUIPMENT_MAX_PRICE) {
        await interaction.reply({
          content: `❌ 가격은 ${formatGold(EQUIPMENT_MAX_PRICE)}를 초과할 수 없습니다.`,
          ephemeral: true,
        });
        return true;
      }

      const totalPrice = pricePerUnit;
      const fee = Math.floor(totalPrice * MARKET_FEE_RATE);
      const netProfit = totalPrice - fee;

      try {
        await prisma.$transaction(async (tx) => {
          const freshEquipment = await tx.equipment.findUnique({
            where: {
              id: equipmentId,
            },
          });

          if (!freshEquipment || freshEquipment.characterId !== character.id) {
            throw new Error('EQUIPMENT_NOT_FOUND');
          }

          if (freshEquipment.equipped) {
            throw new Error('EQUIPMENT_EQUIPPED');
          }

          const duplicated = await tx.marketListing.findFirst({
            where: {
              itemType: 'equipment',
              itemKey: `${equipmentId}`,
              status: 'active',
            },
          });

          if (duplicated) {
            throw new Error('EQUIPMENT_ALREADY_LISTED');
          }

          await tx.marketListing.create({
            data: {
              sellerId: character.id,
              itemType: 'equipment',
              itemKey: `${equipmentId}`,
              itemName: freshEquipment.name,
              quantity: 1,
              pricePerUnit,
              totalPrice,
              itemData: createEquipmentSnapshot(freshEquipment),
              status: 'active',
            },
          });

          // 에스크로 보관: 인벤토리에서 제거 후 거래 완료 시 복원/이전
          await tx.equipment.delete({
            where: {
              id: equipmentId,
            },
          });
        });
      } catch (error) {
        if (error.message === 'EQUIPMENT_NOT_FOUND') {
          await interaction.reply({
            content: '❌ 해당 장비를 찾을 수 없습니다.',
            ephemeral: true,
          });
          return true;
        }

        if (error.message === 'EQUIPMENT_EQUIPPED') {
          await interaction.reply({
            content: '⚠️ 장착 중인 장비는 판매할 수 없습니다.',
            ephemeral: true,
          });
          return true;
        }

        if (error.message === 'EQUIPMENT_ALREADY_LISTED') {
          await interaction.reply({
            content: '❌ 이미 등록된 장비입니다.',
            ephemeral: true,
          });
          return true;
        }

        throw error;
      }

      const rarityData = RARITIES[equipment.rarity] || { emoji: '⚪', name: '일반' };
      const typeData = EQUIPMENT_TYPES[equipment.type] || { name: '장비' };
      const levelSuffix = equipment.upgradeLevel > 0 ? ` +${equipment.upgradeLevel}` : '';

      await interaction.reply({
        content: [
          '✅ 거래소에 등록했습니다!',
          '',
          `${rarityData.emoji} **${equipment.name}${levelSuffix}**`,
          `🧩 ${rarityData.name} ${typeData.name}`,
          `💰 ${formatGold(totalPrice)}`,
          `📊 판매 시 수수료 ${Math.round(MARKET_FEE_RATE * 100)}% (${formatGold(fee)})`,
          `💵 실수령액: ${formatGold(netProfit)}`,
          '',
          '💡 `/market`에서 판매 현황을 확인하세요',
        ].join('\n'),
        ephemeral: true,
      });

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: 'trade_action',
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);

      return true;
    }

    if (action === 'npcmodal') {
      const itemKey = param1;

      if (!RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getCharacterForMarket(prisma, interaction.user.id, true);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const quantity = parsePositiveInteger(interaction.fields.getTextInputValue('quantity'));

      if (!quantity) {
        await interaction.reply({
          content: '❌ 유효한 수량을 입력하세요.',
          ephemeral: true,
        });
        return true;
      }

      const resource = getResourceInfo(itemKey);
      const owned = character.resources.find((entry) => entry.type === itemKey);

      if (!owned || owned.quantity < quantity) {
        await interaction.reply({
          content: `❌ 수량이 부족합니다. (보유: ${owned?.quantity || 0}개)`,
          ephemeral: true,
        });
        return true;
      }

      const snapshot = await fetchOrderBookSnapshot(prisma, itemKey);
      const unitPrice = snapshot.npcPrice?.unitPrice || getResourceBasePrice(itemKey);
      const totalPrice = unitPrice * quantity;
      const remainingQuantity = owned.quantity - quantity;

      await prisma.$transaction(async (tx) => {
        await tx.resource.update({
          where: {
            id: owned.id,
          },
          data: {
            quantity: {
              decrement: quantity,
            },
          },
        });

        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            gold: {
              increment: totalPrice,
            },
            tradeVolume: {
              increment: totalPrice,
            },
          },
        });

        const tradeRecord = await tx.tradeHistory.create({
          data: {
            sellerId: character.id,
            buyerId: NPC_TRADER_ID,
            itemType: 'resource',
            itemKey,
            itemName: resource.name,
            quantity,
            price: totalPrice,
            fee: 0,
          },
        });

        await logTradePricePoint(tx, tradeRecord);
      });

      await interaction.reply({
        content: [
          '✅ NPC 즉시 매입 완료',
          '',
          `${resource.emoji} **${resource.name}** x${quantity}`,
          `🏛️ 매입 단가: ${formatGold(unitPrice)}/개 (${formatTrendLabel(snapshot.npcPrice?.trend)})`,
          `💰 획득 골드: ${formatGold(totalPrice)}`,
          `📦 남은 수량: ${remainingQuantity}개`,
          snapshot.npcPrice?.circuitBreakerTriggered
            ? '🛑 급변동 완화 장치가 적용된 가격입니다.'
            : '✅ 실시간 수급 가격이 적용되었습니다.',
        ].join('\n'),
        ephemeral: true,
      });

      try {
        await recordDailyQuestProgress(prisma, character.id, DAILY_QUEST_EVENTS.MARKET_TRADE, 1);
      } catch (error) {
        console.error('Daily quest progress update failed (npc market trade):', error);
      }

      const onboardingFeedback = await handleOnboardingEvent({
        prisma,
        user: interaction.user,
        eventType: 'trade_action',
      });
      await sendOnboardingFeedback(interaction, onboardingFeedback);

      return true;
    }

    if (action !== 'ordermodal') {
      return false;
    }

    const side = param1;
    const itemKey = param2;

    if (!['sell', 'buy'].includes(side) || !RESOURCES[itemKey]) {
      await interaction.reply({
        content: '❌ 유효하지 않은 주문 요청입니다.',
        ephemeral: true,
      });
      return true;
    }

    const character = await getCharacterForMarket(prisma, interaction.user.id, side === 'sell');

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });
      return true;
    }

    const quantity = parsePositiveInteger(interaction.fields.getTextInputValue('quantity'));
    const price = parsePositiveInteger(interaction.fields.getTextInputValue('price'));

    if (!quantity) {
      await interaction.reply({
        content: '❌ 유효한 수량을 입력하세요.',
        ephemeral: true,
      });
      return true;
    }

    if (!price) {
      await interaction.reply({
        content: '❌ 유효한 가격을 입력하세요.',
        ephemeral: true,
      });
      return true;
    }

    if (price > MAX_PRICE_PER_UNIT) {
      await interaction.reply({
        content: `❌ 개당 가격은 ${formatGold(MAX_PRICE_PER_UNIT)}를 초과할 수 없습니다.`,
        ephemeral: true,
      });
      return true;
    }

    const resource = getResourceInfo(itemKey);

    if (side === 'sell') {
      const owned = character.resources.find((entry) => entry.type === itemKey);

      if (!owned || owned.quantity < quantity) {
        await interaction.reply({
          content: `❌ 수량이 부족합니다. (보유: ${owned?.quantity || 0}개)`,
          ephemeral: true,
        });
        return true;
      }
    }

    if (side === 'buy') {
      const totalReserve = quantity * price;

      if (character.gold < totalReserve) {
        await interaction.reply({
          content: `❌ 골드가 부족합니다. (필요: ${formatGold(totalReserve)}, 보유: ${formatGold(character.gold)})`,
          ephemeral: true,
        });
        return true;
      }
    }

    let placement;

    try {
      placement = await placeOrderWithMatching({
        prisma,
        character,
        side,
        itemKey,
        quantity,
        price,
      });
    } catch (error) {
      if (error.message === 'INSUFFICIENT_RESOURCE') {
        await interaction.reply({
          content: '❌ 주문 등록 중 보유 자원이 부족해졌습니다. 다시 시도하세요.',
          ephemeral: true,
        });
        return true;
      }

      if (error.message === 'INSUFFICIENT_GOLD') {
        await interaction.reply({
          content: '❌ 주문 등록 중 골드가 부족해졌습니다. 다시 시도하세요.',
          ephemeral: true,
        });
        return true;
      }

      throw error;
    }

    const sideLabel = side === 'sell' ? '매도' : '매수';
    const remainingQuantity = placement.order?.quantity || 0;
    const remainingReserve = remainingQuantity * price;
    const sellerNet = placement.matchedGold - placement.matchedFee;

    const message = [
      `✅ ${sideLabel} 주문 등록 완료`,
      '',
      `${resource.emoji} **${resource.name}**`,
      `📌 주문: ${quantity}개 @ ${formatGold(price)}`,
    ];

    if (placement.matchedQuantity > 0) {
      message.push(
        `⚡ 즉시 체결: ${placement.matchedQuantity}개 (총 ${formatGold(placement.matchedGold)})`,
        `🧾 수수료: ${formatGold(placement.matchedFee)}`,
      );

      if (side === 'sell') {
        message.push(`💵 즉시 정산: ${formatGold(sellerNet)}`);
      }
    } else {
      message.push('⌛ 즉시 체결 없이 주문장에 등록되었습니다');
    }

    if (remainingQuantity > 0) {
      if (side === 'sell') {
        message.push(`📦 잔량 ${remainingQuantity}개가 호가창에 유지됩니다`);
      } else {
        message.push(`💰 잔량 예약금 ${formatGold(remainingReserve)}가 유지됩니다`);
      }
    } else {
      message.push('✅ 잔량 없이 전량 체결되었습니다');
    }

    message.push('', '💡 `/market`에서 호가창을 확인하세요');

    await interaction.reply({
      content: message.join('\n'),
      ephemeral: true,
    });

    if (placement.matchedCharacterIds.length > 0) {
      try {
        await Promise.all(
          placement.matchedCharacterIds.map((characterId) =>
            recordDailyQuestProgress(prisma, characterId, DAILY_QUEST_EVENTS.MARKET_TRADE, 1),
          ),
        );
      } catch (error) {
        console.error('Daily quest progress update failed (orderbook trade):', error);
      }
    }

    const onboardingFeedback = await handleOnboardingEvent({
      prisma,
      user: interaction.user,
      eventType: 'trade_action',
    });
    await sendOnboardingFeedback(interaction, onboardingFeedback);

    return true;
  },

  MARKET_BUTTON_PREFIX,
  MARKET_FEE_RATE,
};
