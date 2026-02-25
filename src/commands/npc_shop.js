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
const { getResourceBasePrice } = require('../game/economy');
const {
  getResourceDynamicPrice,
  refreshAllResourceDynamicPrices,
} = require('../game/dynamic-pricing');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { createVillageHomeButton } = require('../utils/village');

const NPC_SHOP_BUTTON_PREFIX = 'npcshop:';
const MAX_SELECT_OPTIONS = 25;
const NPC_TRADER_ID = 0;
const DYNAMIC_PRICE_ITEM_TYPE_RESOURCE = 'resource';
const NPC_SHOP_SALE_TYPE_CONSUMABLE = 'consumable';
const CONSUMABLES = Object.freeze([
  {
    key: 'basic_health_potion',
    itemKey: 'basic_health_potion',
    name: '초급 체력 포션',
    emoji: '❤️',
    buttonLabel: '체력포션',
    description: 'HP 30 회복',
    price: 50,
    type: 'potion',
    effect: 'heal_hp',
    power: 30,
    duration: null,
    buttonStyle: ButtonStyle.Success,
  },
  {
    key: 'basic_mana_potion',
    itemKey: 'basic_mana_potion',
    name: '초급 마나 포션',
    emoji: '🔷',
    buttonLabel: '마나포션',
    description: 'MP 30 회복',
    price: 50,
    type: 'potion',
    effect: 'heal_mp',
    power: 30,
    duration: null,
    buttonStyle: ButtonStyle.Primary,
  },
  {
    key: 'bread',
    itemKey: 'bread',
    name: '빵',
    emoji: '🍞',
    buttonLabel: '빵',
    description: 'HP 10 회복',
    price: 20,
    type: 'food',
    effect: 'heal_hp',
    power: 10,
    duration: null,
    buttonStyle: ButtonStyle.Secondary,
  },
]);
const CONSUMABLE_BY_KEY = Object.freeze(
  Object.fromEntries(CONSUMABLES.map((item) => [item.key, item])),
);

function parsePositiveInteger(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatGold(value) {
  return `${formatNumber(Math.max(0, Number(value) || 0))}G`;
}

function formatPercent(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(2)}%`;
}

function resolveTrendEmoji(trend) {
  if (trend === 'up') {
    return '📈';
  }

  if (trend === 'down') {
    return '📉';
  }

  return '➖';
}

function getSortedResources() {
  return Object.entries(RESOURCES)
    .map(([key, resource]) => ({
      key,
      ...resource,
    }))
    .sort((a, b) => {
      if ((a.tier || 0) !== (b.tier || 0)) {
        return (a.tier || 0) - (b.tier || 0);
      }

      return a.name.localeCompare(b.name, 'ko-KR');
    });
}

function getSupplyDemandText(pressure) {
  if (!pressure) {
    return '✅ 균형';
  }

  return `${pressure.emoji} ${pressure.label}`;
}

function getOwnedResourceEntry(character, itemKey) {
  if (!character || !Array.isArray(character.resources)) {
    return null;
  }

  return character.resources.find((entry) => entry.type === itemKey) || null;
}

function createNpcShopOverviewEmbed({ character, rows }) {
  const lines = rows.map((row, index) => {
    const resource = RESOURCES[row.itemKey] || { emoji: '📦', name: row.itemKey };
    const multiplierChange = (row.currentMultiplier - 1) * 100;
    const trendEmoji = resolveTrendEmoji(row.trend);

    return [
      `${index + 1}. ${resource.emoji} **${resource.name}** ${trendEmoji} ${formatPercent(multiplierChange)}`,
      `   매입 ${formatGold(row.npcBuyPrice)} / 판매 ${formatGold(row.npcSellPrice)} · ${getSupplyDemandText(row.pressure)}`,
    ].join('\n');
  });
  const consumableLines = CONSUMABLES.map((item, index) => (
    `${index + 1}. ${item.emoji} **${item.name}** - ${formatGold(item.price)} (${item.description})`
  ));

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🏪 NPC 동적 상점')
    .setDescription(
      [
        createDivider(),
        character
          ? `👤 ${character.name} | 💰 ${formatGold(character.gold)}`
          : '캐릭터 정보 없음 (가격 조회만 가능)',
        `📊 추적 자원: ${rows.length}종`,
        '',
        lines.length > 0 ? lines.join('\n\n') : '표시할 동적 가격 데이터가 없습니다.',
        '',
        createDivider(),
        '🧪 CONSUMABLES',
        consumableLines.join('\n'),
        '',
        createDivider(),
        '💡 자원을 선택하면 24h 수급 상세를 확인할 수 있습니다.',
      ].join('\n'),
    )
    .setFooter({
      text: '동적 가격은 최근 24시간 수급 비율을 기반으로 계산됩니다.',
    });
}

function createNpcShopDetailEmbed(itemKey, price, { character = null } = {}) {
  const resource = RESOURCES[itemKey];
  const basePrice = getResourceBasePrice(itemKey);
  const marketPrice = Math.floor(basePrice * price.currentMultiplier);
  const marketChangePercent = ((marketPrice - basePrice) / basePrice) * 100;
  const buyChangePercent = ((price.npcBuyPrice - basePrice) / basePrice) * 100;
  const sellChangePercent = ((price.npcSellPrice - basePrice) / basePrice) * 100;
  const trendEmoji = resolveTrendEmoji(price.trend);
  const ownedQuantity = getOwnedResourceEntry(character, itemKey)?.quantity || 0;
  const detailLines = [
    createDivider(),
    `기준가: ${formatGold(basePrice)}`,
    `현재 시세: ${trendEmoji} ${formatGold(marketPrice)} (${formatPercent(marketChangePercent)})`,
    '',
    `공급 상태: ${getSupplyDemandText(price.pressure)}`,
    `- 24h 공급량: ${formatNumber(price.supply24h)}개`,
    `- 24h 수요량: ${formatNumber(price.demand24h)}개`,
    `- 비율: ${price.supplyDemandRatio.toFixed(2)}배`,
    '',
    `💰 NPC 매입가: ${formatGold(price.npcBuyPrice)} (${formatPercent(buyChangePercent)})`,
    `💎 NPC 판매가: ${formatGold(price.npcSellPrice)} (${formatPercent(sellChangePercent)})`,
  ];

  if (character) {
    detailLines.push('', `🎒 내 보유 수량: ${formatNumber(ownedQuantity)}개`);
  }

  detailLines.push('', createDivider(), '💡 플레이어 거래소와 비교해 더 유리한 가격을 선택하세요.');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`🏪 NPC 상점 - ${resource.emoji} ${resource.name}`)
    .setDescription(detailLines.join('\n'));
}

function createOverviewActionRows(rows, { character = null } = {}) {
  const options = rows.slice(0, MAX_SELECT_OPTIONS).map((row) => {
    const resource = RESOURCES[row.itemKey] || { emoji: '📦', name: row.itemKey };
    return {
      value: row.itemKey,
      label: resource.name,
      emoji: resource.emoji,
      description: `매입 ${formatGold(row.npcBuyPrice)} / 판매 ${formatGold(row.npcSellPrice)}`,
    };
  });

  const components = [];

  if (options.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}select`)
          .setPlaceholder('가격 상세를 확인할 자원을 선택하세요')
          .addOptions(options),
      ),
    );
  }

  const currentGold = Math.max(0, Number(character?.gold) || 0);
  components.push(
    new ActionRowBuilder().addComponents(
      CONSUMABLES.map((item) => (
        new ButtonBuilder()
          .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}buy:${item.key}`)
          .setLabel(`${item.buttonLabel} ${formatGold(item.price)}`)
          .setEmoji(item.emoji)
          .setStyle(item.buttonStyle)
          .setDisabled(!character || currentGold < item.price)
      )),
    ),
  );

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}refresh`)
        .setLabel('시세 갱신')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
      createVillageHomeButton({ style: ButtonStyle.Secondary }),
    ),
  );

  return components;
}

function createDetailActionRows(itemKey, { canSell = false } = {}) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}sell:${itemKey}`)
        .setLabel('NPC에게 판매')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canSell),
      new ButtonBuilder()
        .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}refresh:${itemKey}`)
        .setLabel('새로고침')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}main`)
        .setLabel('전체 목록')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      createVillageHomeButton({ style: ButtonStyle.Secondary }),
    ),
  ];
}

function createNpcSellModal({ itemKey, resource, maxQuantity, unitPrice }) {
  const modal = new ModalBuilder()
    .setCustomId(`${NPC_SHOP_BUTTON_PREFIX}sellmodal:${itemKey}`)
    .setTitle(`${resource.name} NPC 판매 (${formatGold(unitPrice)}/개)`);

  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel(`판매 수량 (최대 ${formatNumber(maxQuantity)}개)`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
  return modal;
}

async function getNpcShopCharacter(prisma, userId, { includeResources = false } = {}) {
  if (includeResources) {
    return prisma.character.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
        gold: true,
        resources: {
          select: {
            id: true,
            type: true,
            name: true,
            quantity: true,
          },
        },
      },
    });
  }

  return prisma.character.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      name: true,
      gold: true,
    },
  });
}

function createNpcResourceSaleError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function createNpcConsumablePurchaseError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function executeNpcConsumablePurchase(prisma, { characterId, consumableKey }) {
  if (!Number.isInteger(characterId) || characterId <= 0) {
    throw createNpcConsumablePurchaseError('INVALID_CHARACTER');
  }

  const consumable = CONSUMABLE_BY_KEY[consumableKey];
  if (!consumable) {
    throw createNpcConsumablePurchaseError('INVALID_CONSUMABLE');
  }

  await prisma.$transaction(async (tx) => {
    const latestCharacter = await tx.character.findUnique({
      where: {
        id: characterId,
      },
      select: {
        id: true,
        gold: true,
      },
    });

    if (!latestCharacter) {
      throw createNpcConsumablePurchaseError('CHARACTER_NOT_FOUND');
    }

    if (latestCharacter.gold < consumable.price) {
      throw createNpcConsumablePurchaseError('INSUFFICIENT_GOLD');
    }

    await tx.character.update({
      where: {
        id: characterId,
      },
      data: {
        gold: {
          decrement: consumable.price,
        },
      },
    });

    await tx.consumable.upsert({
      where: {
        characterId_type_effect: {
          characterId,
          type: consumable.type,
          effect: consumable.effect,
        },
      },
      update: {
        quantity: {
          increment: 1,
        },
        name: consumable.name,
        power: consumable.power,
        duration: consumable.duration,
      },
      create: {
        characterId,
        name: consumable.name,
        type: consumable.type,
        effect: consumable.effect,
        power: consumable.power,
        duration: consumable.duration,
        quantity: 1,
      },
    });

    await tx.npcShopSale.create({
      data: {
        characterId,
        saleType: NPC_SHOP_SALE_TYPE_CONSUMABLE,
        itemKey: consumable.itemKey,
        itemName: consumable.name,
        quantity: 1,
        totalPrice: consumable.price,
      },
    });
  });

  return consumable;
}

async function executeNpcResourceSale(
  prisma,
  {
    characterId,
    itemKey,
    quantity,
    priceSnapshot = null,
    now = new Date(),
  },
) {
  if (!Number.isInteger(characterId) || characterId <= 0) {
    throw createNpcResourceSaleError('INVALID_CHARACTER');
  }

  if (!RESOURCES[itemKey]) {
    throw createNpcResourceSaleError('INVALID_RESOURCE');
  }

  const safeQuantity = parsePositiveInteger(quantity);
  if (!safeQuantity) {
    throw createNpcResourceSaleError('INVALID_QUANTITY');
  }

  const resolvedPriceSnapshot = priceSnapshot || await getResourceDynamicPrice(prisma, itemKey, { now });
  if (!resolvedPriceSnapshot) {
    throw createNpcResourceSaleError('PRICE_NOT_FOUND');
  }

  const resource = RESOURCES[itemKey];
  const unitPrice = Math.max(1, resolvedPriceSnapshot.npcBuyPrice || getResourceBasePrice(itemKey));
  const totalPrice = unitPrice * safeQuantity;
  let remainingQuantity = 0;

  await prisma.$transaction(async (tx) => {
    const inventory = await tx.resource.findUnique({
      where: {
        characterId_type: {
          characterId,
          type: itemKey,
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    if (!inventory || inventory.quantity < safeQuantity) {
      throw createNpcResourceSaleError('INSUFFICIENT_RESOURCE');
    }

    remainingQuantity = Math.max(0, inventory.quantity - safeQuantity);

    await tx.resource.update({
      where: {
        id: inventory.id,
      },
      data: {
        quantity: {
          decrement: safeQuantity,
        },
      },
    });

    await tx.character.update({
      where: {
        id: characterId,
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

    await tx.tradeHistory.create({
      data: {
        sellerId: characterId,
        buyerId: NPC_TRADER_ID,
        itemType: DYNAMIC_PRICE_ITEM_TYPE_RESOURCE,
        itemKey,
        itemName: resource.name,
        quantity: safeQuantity,
        price: totalPrice,
        fee: 0,
      },
    });

    await tx.dynamicPrice.upsert({
      where: {
        itemType_itemKey: {
          itemType: DYNAMIC_PRICE_ITEM_TYPE_RESOURCE,
          itemKey,
        },
      },
      update: {
        supply24h: {
          increment: safeQuantity,
        },
        lastUpdated: now,
      },
      create: {
        itemType: DYNAMIC_PRICE_ITEM_TYPE_RESOURCE,
        itemKey,
        basePrice: getResourceBasePrice(itemKey),
        currentMultiplier: Number(resolvedPriceSnapshot.currentMultiplier) || 1,
        npcBuyPrice: unitPrice,
        npcSellPrice: Math.max(
          unitPrice + 1,
          resolvedPriceSnapshot.npcSellPrice || unitPrice + 1,
        ),
        supply24h: safeQuantity,
        demand24h: Math.max(0, Number(resolvedPriceSnapshot.demand24h) || 0),
        lastUpdated: now,
      },
    });
  });

  return {
    itemKey,
    quantity: safeQuantity,
    resource,
    unitPrice,
    totalPrice,
    remainingQuantity,
  };
}

async function loadOverviewRows(prisma) {
  const resources = getSortedResources();
  const dynamicRows = await Promise.all(
    resources.map(({ key }) => getResourceDynamicPrice(prisma, key)),
  );

  return dynamicRows
    .filter(Boolean)
    .sort((a, b) => {
      const tierA = RESOURCES[a.itemKey]?.tier || 0;
      const tierB = RESOURCES[b.itemKey]?.tier || 0;
      if (tierA !== tierB) {
        return tierA - tierB;
      }

      return (RESOURCES[a.itemKey]?.name || '').localeCompare(
        RESOURCES[b.itemKey]?.name || '',
        'ko-KR',
      );
    });
}

async function renderNpcShopOverview(interaction, { prisma, mode = 'reply', forceRefresh = false }) {
  if (forceRefresh) {
    await refreshAllResourceDynamicPrices(prisma);
  }

  const [character, rows] = await Promise.all([
    getNpcShopCharacter(prisma, interaction.user.id),
    loadOverviewRows(prisma),
  ]);

  const payload = {
    embeds: [createNpcShopOverviewEmbed({ character, rows })],
    components: createOverviewActionRows(rows, { character }),
  };

  if (mode === 'update') {
    await interaction.update(payload);
    return true;
  }

  await interaction.reply(payload);
  return true;
}

async function renderNpcShopDetail(
  interaction,
  { prisma, itemKey, mode = 'reply', forceRefresh = false },
) {
  if (!RESOURCES[itemKey]) {
    const payload = {
      content: '❌ 유효하지 않은 자원입니다.',
      ephemeral: true,
    };

    if (mode === 'update') {
      await interaction.reply(payload);
    } else {
      await interaction.reply(payload);
    }

    return true;
  }

  const [character, price] = await Promise.all([
    getNpcShopCharacter(prisma, interaction.user.id, { includeResources: true }),
    getResourceDynamicPrice(prisma, itemKey, { forceRefresh }),
  ]);

  if (!price) {
    await interaction.reply({
      content: '❌ 동적 가격 정보를 가져오지 못했습니다.',
      ephemeral: true,
    });
    return true;
  }

  const ownedQuantity = getOwnedResourceEntry(character, itemKey)?.quantity || 0;

  const payload = {
    embeds: [createNpcShopDetailEmbed(itemKey, price, { character })],
    components: createDetailActionRows(itemKey, {
      canSell: Boolean(character) && ownedQuantity > 0,
    }),
  };

  if (mode === 'update') {
    await interaction.update(payload);
    return true;
  }

  await interaction.reply(payload);
  return true;
}

const resourceChoices = getSortedResources()
  .slice(0, MAX_SELECT_OPTIONS)
  .map((resource) => ({
    name: resource.name,
    value: resource.key,
  }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('npc_shop')
		.setNameLocalizations({ "en-US": "npc-shop" })
    .setDescription('NPC 상점의 동적 가격을 확인합니다')
		.setDescriptionLocalizations({ "en-US": "View NPC 상점의 동적 가격" })
    .addStringOption((option) =>
      option
        .setName('resource')
        .setDescription('상세 가격을 확인할 자원')
        .setRequired(false)
        .addChoices(...resourceChoices),
    ),

  async execute(interaction, { prisma }) {
    const itemKey = interaction.options.getString('resource');

    if (itemKey) {
      await renderNpcShopDetail(interaction, {
        prisma,
        itemKey,
        mode: 'reply',
      });
      return;
    }

    await renderNpcShopOverview(interaction, {
      prisma,
      mode: 'reply',
    });
  },

  async handleNpcShopButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(NPC_SHOP_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    if (action === 'main') {
      await renderNpcShopOverview(interaction, {
        prisma,
        mode: 'update',
      });
      return true;
    }

    if (action === 'refresh') {
      if (param) {
        await renderNpcShopDetail(interaction, {
          prisma,
          itemKey: param,
          mode: 'update',
          forceRefresh: true,
        });
        return true;
      }

      await renderNpcShopOverview(interaction, {
        prisma,
        mode: 'update',
        forceRefresh: true,
      });
      return true;
    }

    if (action === 'sell') {
      if (!RESOURCES[param]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getNpcShopCharacter(prisma, interaction.user.id, {
        includeResources: true,
      });

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const owned = getOwnedResourceEntry(character, param);

      if (!owned || owned.quantity <= 0) {
        await interaction.reply({
          content: `❌ ${RESOURCES[param].name} 보유 수량이 부족합니다.`,
          ephemeral: true,
        });
        return true;
      }

      const price = await getResourceDynamicPrice(prisma, param);

      if (!price) {
        await interaction.reply({
          content: '❌ 동적 가격 정보를 가져오지 못했습니다.',
          ephemeral: true,
        });
        return true;
      }

      await interaction.showModal(
        createNpcSellModal({
          itemKey: param,
          resource: RESOURCES[param],
          maxQuantity: owned.quantity,
          unitPrice: price.npcBuyPrice,
        }),
      );
      return true;
    }

    if (action === 'buy') {
      const consumable = CONSUMABLE_BY_KEY[param];

      if (!consumable) {
        await interaction.reply({
          content: '❌ 유효하지 않은 소비 아이템입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getNpcShopCharacter(prisma, interaction.user.id);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (character.gold < consumable.price) {
        await interaction.reply({
          content: `💰 골드가 부족합니다. (필요: ${formatGold(consumable.price)})`,
          ephemeral: true,
        });
        return true;
      }

      try {
        await executeNpcConsumablePurchase(prisma, {
          characterId: character.id,
          consumableKey: param,
        });
      } catch (error) {
        if (error.code === 'INSUFFICIENT_GOLD') {
          await interaction.reply({
            content: `💰 골드가 부족합니다. (필요: ${formatGold(consumable.price)})`,
            ephemeral: true,
          });
          return true;
        }

        if (error.code === 'CHARACTER_NOT_FOUND') {
          await interaction.reply({
            content: '캐릭터를 찾을 수 없습니다.',
            ephemeral: true,
          });
          return true;
        }

        throw error;
      }

      await interaction.reply({
        content: `✅ ${consumable.emoji} ${consumable.name} 구매 완료! (-${formatGold(consumable.price)})\n💡 소비템 인벤토리에 추가되었습니다.`,
        ephemeral: true,
      });
      return true;
    }

    return false;
  },

  async handleNpcShopSelect(interaction, { prisma }) {
    if (interaction.customId !== `${NPC_SHOP_BUTTON_PREFIX}select`) {
      return false;
    }

    const itemKey = interaction.values[0];
    await renderNpcShopDetail(interaction, {
      prisma,
      itemKey,
      mode: 'update',
    });
    return true;
  },

  async handleNpcShopModal(interaction, { prisma }) {
    if (!interaction.customId.startsWith(NPC_SHOP_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(NPC_SHOP_BUTTON_PREFIX.length);
    const [action, itemKey] = customId.split(':');

    if (action !== 'sellmodal') {
      return false;
    }

    if (!RESOURCES[itemKey]) {
      await interaction.reply({
        content: '❌ 유효하지 않은 자원입니다.',
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

    const character = await getNpcShopCharacter(prisma, interaction.user.id, {
      includeResources: true,
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });
      return true;
    }

    const owned = getOwnedResourceEntry(character, itemKey);

    if (!owned || owned.quantity < quantity) {
      await interaction.reply({
        content: `❌ 수량이 부족합니다. (보유: ${formatNumber(owned?.quantity || 0)}개)`,
        ephemeral: true,
      });
      return true;
    }

    const priceSnapshot = await getResourceDynamicPrice(prisma, itemKey);

    if (!priceSnapshot) {
      await interaction.reply({
        content: '❌ 동적 가격 정보를 가져오지 못했습니다.',
        ephemeral: true,
      });
      return true;
    }

    let saleResult;
    try {
      saleResult = await executeNpcResourceSale(prisma, {
        characterId: character.id,
        itemKey,
        quantity,
        priceSnapshot,
        now: new Date(),
      });
    } catch (error) {
      if (error.code === 'INSUFFICIENT_RESOURCE') {
        await interaction.reply({
          content: '❌ 거래 처리 중 보유 수량이 부족해졌습니다. 다시 시도하세요.',
          ephemeral: true,
        });
        return true;
      }

      throw error;
    }

    await interaction.reply({
      content: [
        '✅ NPC 판매 완료',
        '',
        `${saleResult.resource.emoji} **${saleResult.resource.name}** x${formatNumber(saleResult.quantity)}`,
        `💰 매입 단가: ${formatGold(saleResult.unitPrice)}/개`,
        `💵 획득 골드: ${formatGold(saleResult.totalPrice)}`,
        `📦 남은 수량: ${formatNumber(saleResult.remainingQuantity)}개`,
      ].join('\n'),
      ephemeral: true,
    });

    return true;
  },

  NPC_SHOP_BUTTON_PREFIX,
  getNpcShopCharacter,
  getOwnedResourceEntry,
  executeNpcResourceSale,
  executeNpcConsumablePurchase,
};
