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
const { getResourceDynamicPrice } = require('../game/dynamic-pricing');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { createVillageHomeButton } = require('../utils/village');
const { executeNpcResourceSale } = require('./npc_shop');

const SELL_RESOURCES_BUTTON_PREFIX = 'sellres:';
const MAX_SELECT_OPTIONS = 25;

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

function getSortedResourceRows(resourceEntries) {
  return (Array.isArray(resourceEntries) ? resourceEntries : [])
    .filter((entry) => entry && Number(entry.quantity) > 0)
    .map((entry) => {
      const resource = RESOURCES[entry.type] || {};
      return {
        itemKey: entry.type,
        quantity: Math.max(0, Number(entry.quantity) || 0),
        name: resource.name || entry.name || entry.type,
        emoji: resource.emoji || '📦',
        tier: resource.tier || 0,
      };
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }

      return a.name.localeCompare(b.name, 'ko-KR');
    });
}

async function getSellResourcesCharacter(prisma, userId) {
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

function resolveSelectedRow(rows, selectedItemKey = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  if (selectedItemKey) {
    const matched = rows.find((row) => row.itemKey === selectedItemKey);
    if (matched) {
      return matched;
    }
  }

  return rows[0];
}

async function loadSellResourcePriceRows(
  prisma,
  character,
  {
    forceRefresh = false,
  } = {},
) {
  const sortedResources = getSortedResourceRows(character?.resources);

  const rows = await Promise.all(
    sortedResources.map(async (resourceRow) => {
      const priceSnapshot = await getResourceDynamicPrice(prisma, resourceRow.itemKey, {
        forceRefresh,
      });
      const npcBuyPrice = Math.max(1, Number(priceSnapshot?.npcBuyPrice) || 0);

      return {
        ...resourceRow,
        npcBuyPrice,
        totalSellPrice: npcBuyPrice * resourceRow.quantity,
      };
    }),
  );

  return rows;
}

function createSellResourcesEmbed({ character, rows, selectedRow = null }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle('💰 자원 판매소')
      .setDescription(
        [
          createDivider(),
          `👤 ${character.name} | 💰 ${formatGold(character.gold)}`,
          '',
          '판매 가능한 자원이 없습니다.',
          '💡 `/gather`로 자원을 먼저 채집하세요.',
          createDivider(),
        ].join('\n'),
      );
  }

  const listLines = rows.slice(0, 15).map((row, index) => {
    const linePrefix = selectedRow?.itemKey === row.itemKey ? '👉 ' : '';
    return `${linePrefix}${index + 1}. ${row.emoji} **${row.name}** x${formatNumber(row.quantity)} · ${formatGold(row.npcBuyPrice)}/개`;
  });

  const detailLines = selectedRow
    ? [
      '',
      '선택 자원',
      `${selectedRow.emoji} **${selectedRow.name}**`,
      `보유: ${formatNumber(selectedRow.quantity)}개`,
      `NPC 매입가: ${formatGold(selectedRow.npcBuyPrice)}/개`,
      `절반 판매 예상: ${formatGold(selectedRow.npcBuyPrice * Math.floor(selectedRow.quantity / 2))}`,
      `전체 판매 예상: ${formatGold(selectedRow.totalSellPrice)}`,
    ]
    : [];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('💰 자원 판매소')
    .setDescription(
      [
        createDivider(),
        `👤 ${character.name} | 💰 ${formatGold(character.gold)}`,
        '',
        '보유 자원 + NPC 매입가',
        listLines.join('\n'),
        rows.length > 15 ? `... 외 ${rows.length - 15}종` : '',
        ...detailLines,
        '',
        createDivider(),
        '💡 자원을 선택한 뒤 [판매하기], [절반 판매], [전체 판매]를 사용할 수 있습니다.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({
      text: 'NPC 매입가는 시장 수급에 따라 변동됩니다.',
    });
}

function createSellResourcesModal({ itemKey, resourceName, maxQuantity, unitPrice }) {
  const modal = new ModalBuilder()
    .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}sellmodal:${itemKey}`)
    .setTitle(`${resourceName} 판매 (${formatGold(unitPrice)}/개)`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel(`판매 수량 (최대 ${formatNumber(maxQuantity)}개)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10),
    ),
  );

  return modal;
}

function createSellResourcesActionRows(rows, selectedRow = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}refresh`)
          .setLabel('새로고침')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Primary),
        createVillageHomeButton({ style: ButtonStyle.Secondary }),
      ),
    ];
  }

  const options = rows.slice(0, MAX_SELECT_OPTIONS).map((row) => ({
    value: row.itemKey,
    label: row.name,
    emoji: row.emoji,
    description: `보유 ${formatNumber(row.quantity)}개 · ${formatGold(row.npcBuyPrice)}/개`,
    default: selectedRow?.itemKey === row.itemKey,
  }));

  const resolvedSelected = selectedRow || rows[0];
  const halfQuantity = Math.floor(resolvedSelected.quantity / 2);
  const canQuickHalf = halfQuantity > 0;
  const canQuickAll = resolvedSelected.quantity > 0;

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}select`)
        .setPlaceholder('판매할 자원을 선택하세요')
        .addOptions(options),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}sell:${resolvedSelected.itemKey}`)
        .setLabel('판매하기')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canQuickAll),
      new ButtonBuilder()
        .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}quick:${resolvedSelected.itemKey}:half`)
        .setLabel('절반 판매')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canQuickHalf),
      new ButtonBuilder()
        .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}quick:${resolvedSelected.itemKey}:all`)
        .setLabel('전체 판매')
        .setEmoji('🏦')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!canQuickAll),
      new ButtonBuilder()
        .setCustomId(`${SELL_RESOURCES_BUTTON_PREFIX}refresh`)
        .setLabel('새로고침')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      createVillageHomeButton({ style: ButtonStyle.Secondary }),
    ),
  ];
}

async function renderSellResourcesMenu(
  interaction,
  {
    prisma,
    mode = 'reply',
    selectedItemKey = null,
    forceRefresh = false,
  },
) {
  const character = await getSellResourcesCharacter(prisma, interaction.user.id);

  if (!character) {
    const payload = {
      content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
      ephemeral: true,
    };

    if (mode === 'update') {
      await interaction.reply(payload);
      return true;
    }

    await interaction.reply(payload);
    return true;
  }

  const rows = await loadSellResourcePriceRows(prisma, character, {
    forceRefresh,
  });
  const selectedRow = resolveSelectedRow(rows, selectedItemKey);
  const payload = {
    embeds: [createSellResourcesEmbed({ character, rows, selectedRow })],
    components: createSellResourcesActionRows(rows, selectedRow),
  };

  if (mode === 'update') {
    await interaction.update(payload);
    return true;
  }

  await interaction.reply(payload);
  return true;
}

function resolveQuickSellQuantity(mode, quantity) {
  if (mode === 'all') {
    return quantity;
  }

  if (mode === 'half') {
    return Math.floor(quantity / 2);
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sell_resources')
    .setDescription('보유한 자원을 NPC에게 빠르게 판매합니다'),

  async execute(interaction, { prisma }) {
    await renderSellResourcesMenu(interaction, {
      prisma,
      mode: 'reply',
    });
  },

  async handleSellResourcesButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
      return false;
    }

    const parts = interaction.customId.slice(SELL_RESOURCES_BUTTON_PREFIX.length).split(':');
    const action = parts[0];
    const itemKey = parts[1];

    if (action === 'refresh') {
      await renderSellResourcesMenu(interaction, {
        prisma,
        mode: 'update',
        forceRefresh: true,
      });
      return true;
    }

    if (action === 'sell') {
      if (!RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getSellResourcesCharacter(prisma, interaction.user.id);
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
          content: `❌ ${RESOURCES[itemKey].name} 보유 수량이 부족합니다.`,
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

      await interaction.showModal(
        createSellResourcesModal({
          itemKey,
          resourceName: RESOURCES[itemKey].name,
          maxQuantity: owned.quantity,
          unitPrice: priceSnapshot.npcBuyPrice,
        }),
      );
      return true;
    }

    if (action === 'quick') {
      const mode = parts[2];

      if (!RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return true;
      }

      const character = await getSellResourcesCharacter(prisma, interaction.user.id);
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
          content: `❌ ${RESOURCES[itemKey].name} 보유 수량이 부족합니다.`,
          ephemeral: true,
        });
        return true;
      }

      const quantity = resolveQuickSellQuantity(mode, owned.quantity);
      if (!quantity || quantity <= 0) {
        await interaction.reply({
          content: '❌ 빠른 판매 수량을 계산할 수 없습니다.',
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

      await renderSellResourcesMenu(interaction, {
        prisma,
        mode: 'update',
        selectedItemKey: itemKey,
      });

      await interaction.followUp({
        content: [
          '✅ 빠른 판매 완료',
          `${saleResult.resource.emoji} **${saleResult.resource.name}** x${formatNumber(saleResult.quantity)}`,
          `💵 획득 골드: ${formatGold(saleResult.totalPrice)}`,
          `📦 남은 수량: ${formatNumber(saleResult.remainingQuantity)}개`,
        ].join('\n'),
        ephemeral: true,
      });
      return true;
    }

    return false;
  },

  async handleSellResourcesSelect(interaction, { prisma }) {
    if (interaction.customId !== `${SELL_RESOURCES_BUTTON_PREFIX}select`) {
      return false;
    }

    const selectedItemKey = interaction.values?.[0] || null;
    await renderSellResourcesMenu(interaction, {
      prisma,
      mode: 'update',
      selectedItemKey,
    });
    return true;
  },

  async handleSellResourcesModal(interaction, { prisma }) {
    if (!interaction.customId.startsWith(SELL_RESOURCES_BUTTON_PREFIX)) {
      return false;
    }

    const [action, itemKey] = interaction.customId
      .slice(SELL_RESOURCES_BUTTON_PREFIX.length)
      .split(':');

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

    const character = await getSellResourcesCharacter(prisma, interaction.user.id);
    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });
      return true;
    }

    const owned = character.resources.find((entry) => entry.type === itemKey);
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
        '✅ 자원 판매 완료',
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

  SELL_RESOURCES_BUTTON_PREFIX,
  getSellResourcesCharacter,
  loadSellResourcePriceRows,
};
