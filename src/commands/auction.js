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

const { EQUIPMENT_TYPES, RARITIES } = require('../game/equipment');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { createVillageHomeButton } = require('../utils/village');
const {
  AUCTION_FEE_RATE,
  AUCTION_ALLOWED_DURATIONS_HOURS,
  AUCTION_MIN_START_PRICE,
  AUCTION_MAX_START_PRICE,
  AUCTION_STATUSES,
  isAuctionableRarity,
  resolveMinimumBidAmount,
  listActiveAuctions,
  listCharacterAuctions,
  getAuctionDetail,
  createAuction,
  placeAuctionBid,
  finalizeAuction,
  getAuctionRemainingMs,
} = require('../game/auction-house');
const { formatGold, parsePositiveInteger } = require('../utils/formatting');
const { MAX_SELECT_OPTIONS } = require('../config/discord-constants');

const AUCTION_BUTTON_PREFIX = 'auction:';

function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function formatRemainingTime(expiresAt, now = new Date()) {
  const expires = new Date(expiresAt);
  const remainingMs = Math.max(0, expires.getTime() - now.getTime());
  if (remainingMs === 0) {
    return '마감';
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${minutes}분`;
}

function resolveAuctionStatusLabel(auction, now = new Date()) {
  if (auction.status === AUCTION_STATUSES.completed) {
    return '✅ 낙찰 완료';
  }

  if (auction.status === AUCTION_STATUSES.cancelled) {
    return '🟨 유찰/취소';
  }

  const remainingMs = getAuctionRemainingMs(auction, now);
  if (remainingMs <= 0) {
    return '⌛ 정산 대기';
  }

  return '🟢 진행 중';
}

function getAuctionItemMeta(auction) {
  const data = auction?.itemData && typeof auction.itemData === 'object' ? auction.itemData : {};
  const rarity = RARITIES[data.rarity || 'common'] || { emoji: '⚪', name: '일반' };
  const type = EQUIPMENT_TYPES[data.type || 'weapon'] || { emoji: '⚔️', name: '장비' };
  const levelSuffix = data.upgradeLevel > 0 ? ` +${data.upgradeLevel}` : '';

  return {
    rarity,
    type,
    levelSuffix,
  };
}

function maskHighestBidder(auction, viewerCharacterId) {
  if (!auction.highestBidderId || auction.bidCount <= 0) {
    return '없음';
  }

  if (viewerCharacterId && auction.highestBidderId === viewerCharacterId) {
    return '[익명] (나)';
  }

  return '[익명]';
}

function createAuctionMainEmbed({ character, auctions }) {
  const lines = auctions.map((auction, index) => {
    const meta = getAuctionItemMeta(auction);

    return [
      `${index + 1}. ${meta.rarity.emoji} ${meta.type.emoji} **${auction.itemName}${meta.levelSuffix}**`,
      `   현재가 ${formatGold(auction.currentPrice)} | 입찰 ${auction.bidCount}회 | 마감 ${formatRemainingTime(auction.expiresAt)}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('🔨 경매장')
    .setDescription(
      [
        createDivider(),
        `👤 ${character.name} | 💰 보유 골드 ${formatGold(character.gold)}`,
        `📊 진행 중 경매: ${auctions.length}건`,
        '',
        lines.length > 0 ? lines.join('\n\n') : '현재 진행 중인 경매가 없습니다.',
        '',
        createDivider(),
        '💡 버튼과 선택 메뉴로 경매 등록/입찰/종료를 진행하세요.',
      ].join('\n'),
    )
    .setFooter({
      text: `낙찰 수수료 ${Math.round(AUCTION_FEE_RATE * 100)}%`,
    });
}

function createAuctionMainComponents(auctions) {
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}create`)
        .setLabel('경매 등록')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}refresh`)
        .setLabel('새로고침')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}mine`)
        .setLabel('내 경매')
        .setEmoji('📌')
        .setStyle(ButtonStyle.Primary),
      createVillageHomeButton({ style: ButtonStyle.Secondary }),
    ),
  ];

  if (auctions.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${AUCTION_BUTTON_PREFIX}select:view`)
          .setPlaceholder('상세 확인할 경매를 선택하세요')
          .addOptions(
            auctions.slice(0, MAX_SELECT_OPTIONS).map((auction) => {
              const meta = getAuctionItemMeta(auction);
              return {
                value: `${auction.id}`,
                label: truncateText(`${auction.itemName}${meta.levelSuffix}`),
                description: truncateText(
                  `${meta.rarity.name} ${meta.type.name} | 현재가 ${formatGold(auction.currentPrice)}`,
                ),
                emoji: meta.rarity.emoji,
              };
            }),
          ),
      ),
    );
  }

  return rows;
}

function createMyAuctionsEmbed({ character, auctions }) {
  const lines = auctions.map((auction, index) => {
    const meta = getAuctionItemMeta(auction);
    const status = resolveAuctionStatusLabel(auction);

    return [
      `${index + 1}. ${meta.rarity.emoji} **${auction.itemName}${meta.levelSuffix}** · ${status}`,
      `   현재가 ${formatGold(auction.currentPrice)} | 입찰 ${auction.bidCount}회 | 마감 ${formatRemainingTime(auction.expiresAt)}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('📌 내 경매')
    .setDescription(
      [
        createDivider(),
        `👤 ${character.name}`,
        `📦 등록 경매: ${auctions.length}건`,
        '',
        lines.length > 0 ? lines.join('\n\n') : '등록한 경매가 없습니다.',
        '',
        createDivider(),
      ].join('\n'),
    );
}

function createMyAuctionsComponents(auctions) {
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}main`)
        .setLabel('경매장 메인')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}mine`)
        .setLabel('새로고침')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      createVillageHomeButton({ style: ButtonStyle.Secondary }),
    ),
  ];

  if (auctions.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${AUCTION_BUTTON_PREFIX}select:view`)
          .setPlaceholder('상세 확인할 경매를 선택하세요')
          .addOptions(
            auctions.slice(0, MAX_SELECT_OPTIONS).map((auction) => {
              const meta = getAuctionItemMeta(auction);
              return {
                value: `${auction.id}`,
                label: truncateText(`${auction.itemName}${meta.levelSuffix}`),
                description: truncateText(
                  `${resolveAuctionStatusLabel(auction)} | 현재가 ${formatGold(auction.currentPrice)}`,
                ),
                emoji: meta.rarity.emoji,
              };
            }),
          ),
      ),
    );
  }

  return rows;
}

function createAuctionDetailEmbed(auction, viewerCharacterId) {
  const meta = getAuctionItemMeta(auction);
  const highestBidder = maskHighestBidder(auction, viewerCharacterId);
  const minBidAmount = resolveMinimumBidAmount(auction);
  const recentBidLines = (auction.bids || [])
    .slice(0, 5)
    .map((bid, index) => `${index + 1}. [익명] ${formatGold(bid.bidAmount)}`)
    .join('\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(`${meta.rarity.emoji} ${meta.type.emoji} ${auction.itemName}${meta.levelSuffix}`)
    .setDescription(
      [
        createDivider(),
        `상태: ${resolveAuctionStatusLabel(auction)}`,
        `판매자: ${auction.seller?.name || '알 수 없음'}`,
        `시작가: ${formatGold(auction.startPrice)}`,
        `현재가: ${formatGold(auction.currentPrice)}`,
        `최소 입찰가: ${formatGold(minBidAmount)}`,
        `입찰 수: ${auction.bidCount}회`,
        `최고 입찰자: ${highestBidder}`,
        `마감: ${formatRemainingTime(auction.expiresAt)}`,
        auction.reservePrice ? `예약가: ${formatGold(auction.reservePrice)}` : '예약가: 없음',
        '',
        '최근 입찰',
        recentBidLines || '입찰 기록 없음',
        '',
        createDivider(),
      ].join('\n'),
    );
}

function createAuctionDetailComponents(auction, viewerCharacterId) {
  const isSeller = viewerCharacterId && auction.sellerId === viewerCharacterId;
  const isActive = auction.status === AUCTION_STATUSES.active;

  const actionButtons = [
    new ButtonBuilder()
      .setCustomId(`${AUCTION_BUTTON_PREFIX}bid:${auction.id}`)
      .setLabel('입찰하기')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isActive || isSeller),
  ];

  if (isSeller && isActive) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}end:${auction.id}`)
        .setLabel('경매 종료')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger),
    );
  }

  actionButtons.push(
    new ButtonBuilder()
      .setCustomId(`${AUCTION_BUTTON_PREFIX}refresh:${auction.id}`)
      .setLabel('새로고침')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${AUCTION_BUTTON_PREFIX}main`)
      .setLabel('메인')
      .setEmoji('🔨')
      .setStyle(ButtonStyle.Primary),
    createVillageHomeButton({ style: ButtonStyle.Secondary }),
  );

  return [new ActionRowBuilder().addComponents(actionButtons)];
}

function createAuctionCreateEmbed(equipmentList) {
  const rarityText = [...AUCTION_ALLOWED_DURATIONS_HOURS].join(' / ');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('📝 경매 등록')
    .setDescription(
      [
        createDivider(),
        `등록 가능 장비: ${equipmentList.length}개 (희귀 이상, 미장착)`,
        '',
        `허용 기간: ${rarityText}시간`,
        `시작가 범위: ${formatGold(AUCTION_MIN_START_PRICE)} ~ ${formatGold(AUCTION_MAX_START_PRICE)}`,
        '',
        '등록할 장비를 선택하면 가격/기간 입력 창이 열립니다.',
        createDivider(),
      ].join('\n'),
    );
}

function createAuctionCreateComponents(equipmentList) {
  const options = equipmentList.slice(0, MAX_SELECT_OPTIONS).map((equipment) => {
    const rarity = RARITIES[equipment.rarity] || { emoji: '⚪', name: '일반' };
    const type = EQUIPMENT_TYPES[equipment.type] || { name: '장비' };
    const levelSuffix = equipment.upgradeLevel > 0 ? ` +${equipment.upgradeLevel}` : '';

    return {
      value: `${equipment.id}`,
      label: truncateText(`${equipment.name}${levelSuffix}`),
      description: truncateText(`${rarity.name} ${type.name}`),
      emoji: rarity.emoji,
    };
  });

  const rows = [];
  if (options.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${AUCTION_BUTTON_PREFIX}select:create`)
          .setPlaceholder('등록할 장비를 선택하세요')
          .addOptions(options),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${AUCTION_BUTTON_PREFIX}main`)
        .setLabel('메인')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Primary),
      createVillageHomeButton({ style: ButtonStyle.Secondary }),
    ),
  );

  return rows;
}

async function getAuctionCharacter(prisma, userId, includeEquipment = false) {
  return prisma.character.findUnique({
    where: {
      userId,
    },
    include: {
      equipment: includeEquipment,
    },
  });
}

async function renderAuctionMain(interaction, { prisma, mode = 'reply' }) {
  const [character, auctions] = await Promise.all([
    getAuctionCharacter(prisma, interaction.user.id),
    listActiveAuctions(prisma, { take: 15 }),
  ]);

  if (!character) {
    await interaction.reply({
      content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
      ephemeral: true,
    });
    return true;
  }

  const payload = {
    embeds: [createAuctionMainEmbed({ character, auctions })],
    components: createAuctionMainComponents(auctions),
  };

  if (mode === 'update') {
    await interaction.update(payload);
    return true;
  }

  await interaction.reply(payload);
  return true;
}

async function renderMyAuctions(interaction, { prisma }) {
  const character = await getAuctionCharacter(prisma, interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '캐릭터를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return true;
  }

  const auctions = await listCharacterAuctions(prisma, character.id, {
    take: 20,
  });

  await interaction.update({
    embeds: [createMyAuctionsEmbed({ character, auctions })],
    components: createMyAuctionsComponents(auctions),
  });
  return true;
}

async function renderAuctionDetail(interaction, { prisma, auctionId, mode = 'update' }) {
  const [character, auction] = await Promise.all([
    getAuctionCharacter(prisma, interaction.user.id),
    getAuctionDetail(prisma, auctionId),
  ]);

  if (!character) {
    await interaction.reply({
      content: '캐릭터를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return true;
  }

  if (!auction) {
    await interaction.reply({
      content: '❌ 경매를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return true;
  }

  const payload = {
    embeds: [createAuctionDetailEmbed(auction, character.id)],
    components: createAuctionDetailComponents(auction, character.id),
  };

  if (mode === 'update') {
    await interaction.update(payload);
  } else {
    await interaction.reply(payload);
  }

  return true;
}

async function showAuctionCreateSelection(interaction, { prisma }) {
  const character = await getAuctionCharacter(prisma, interaction.user.id, true);

  if (!character) {
    await interaction.reply({
      content: '캐릭터를 찾을 수 없습니다.',
      ephemeral: true,
    });
    return true;
  }

  const auctionableEquipment = character.equipment.filter(
    (equipment) => !equipment.equipped && isAuctionableRarity(equipment.rarity),
  );

  if (auctionableEquipment.length === 0) {
    await interaction.reply({
      content: '❌ 등록 가능한 장비가 없습니다. (희귀 이상, 미장착 장비만 가능)',
      ephemeral: true,
    });
    return true;
  }

  await interaction.update({
    embeds: [createAuctionCreateEmbed(auctionableEquipment)],
    components: createAuctionCreateComponents(auctionableEquipment),
  });
  return true;
}

function createAuctionModal(equipmentId) {
  const modal = new ModalBuilder()
    .setCustomId(`${AUCTION_BUTTON_PREFIX}createmodal:${equipmentId}`)
    .setTitle('경매 등록');

  const priceInput = new TextInputBuilder()
    .setCustomId('startPrice')
    .setLabel('시작가 (골드)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('50000')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  const durationInput = new TextInputBuilder()
    .setCustomId('durationHours')
    .setLabel('경매 기간 (1, 6, 24 시간)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('6')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2);

  const reserveInput = new TextInputBuilder()
    .setCustomId('reservePrice')
    .setLabel('예약가 (선택, 비워두면 없음)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('70000')
    .setRequired(false)
    .setMinLength(0)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(reserveInput),
  );

  return modal;
}

function createBidModal(auctionId, minimumBidAmount) {
  const modal = new ModalBuilder()
    .setCustomId(`${AUCTION_BUTTON_PREFIX}bidmodal:${auctionId}`)
    .setTitle('경매 입찰');

  const amountInput = new TextInputBuilder()
    .setCustomId('bidAmount')
    .setLabel(`입찰 금액 (최소 ${formatGold(minimumBidAmount)})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`${minimumBidAmount}`)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  return modal;
}

function mapAuctionErrorToMessage(error) {
  const messageMap = {
    CHARACTER_NOT_FOUND: '캐릭터를 찾을 수 없습니다.',
    AUCTION_NOT_FOUND: '경매를 찾을 수 없습니다.',
    AUCTION_NOT_ACTIVE: '진행 중인 경매가 아닙니다.',
    AUCTION_EXPIRED: '이미 마감된 경매입니다.',
    SELF_BID_NOT_ALLOWED: '자신이 등록한 경매에는 입찰할 수 없습니다.',
    BID_TOO_LOW: '최소 입찰가 이상으로 입력해주세요.',
    INVALID_BID_AMOUNT: '유효한 입찰 금액을 입력해주세요.',
    INSUFFICIENT_GOLD: '골드가 부족합니다.',
    AUCTION_CONFLICT: '입찰 경합이 발생했습니다. 새로고침 후 다시 시도해주세요.',
    INVALID_EQUIPMENT: '유효하지 않은 장비입니다.',
    EQUIPMENT_NOT_FOUND: '장비를 찾을 수 없습니다.',
    EQUIPMENT_EQUIPPED: '장착 중인 장비는 등록할 수 없습니다.',
    RARITY_NOT_ALLOWED: '희귀 이상 장비만 경매 등록이 가능합니다.',
    EQUIPMENT_ALREADY_LISTED: '이미 등록된 장비입니다.',
    INVALID_START_PRICE: '유효한 시작가를 입력해주세요.',
    START_PRICE_TOO_HIGH: '시작가가 너무 높습니다.',
    INVALID_DURATION: '경매 기간은 1, 6, 24시간만 가능합니다.',
    INVALID_RESERVE_PRICE: '예약가는 시작가 이상이어야 합니다.',
    INVALID_AUCTION: '유효하지 않은 경매입니다.',
  };

  return messageMap[error.message] || '처리 중 오류가 발생했습니다.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auction')
		.setNameLocalizations({ "en-US": "auction" })
    .setDescription('실시간 입찰 경매장을 이용합니다')
		.setDescriptionLocalizations({ "en-US": "실시간 입찰 경매장을 이용합니다" }),

  async execute(interaction, { prisma }) {
    await renderAuctionMain(interaction, { prisma, mode: 'reply' });
  },

  async handleAuctionButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(AUCTION_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    if (action === 'main') {
      await renderAuctionMain(interaction, { prisma, mode: 'update' });
      return true;
    }

    if (action === 'refresh') {
      if (param) {
        await renderAuctionDetail(interaction, {
          prisma,
          auctionId: param,
          mode: 'update',
        });
        return true;
      }

      await renderAuctionMain(interaction, { prisma, mode: 'update' });
      return true;
    }

    if (action === 'mine') {
      await renderMyAuctions(interaction, { prisma });
      return true;
    }

    if (action === 'create') {
      await showAuctionCreateSelection(interaction, { prisma });
      return true;
    }

    if (action === 'bid' && param) {
      const [character, auction] = await Promise.all([
        getAuctionCharacter(prisma, interaction.user.id),
        getAuctionDetail(prisma, param),
      ]);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (!auction || auction.status !== AUCTION_STATUSES.active) {
        await interaction.reply({
          content: '진행 중인 경매를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (auction.sellerId === character.id) {
        await interaction.reply({
          content: '자신의 경매에는 입찰할 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const minimumBidAmount = resolveMinimumBidAmount(auction);
      await interaction.showModal(createBidModal(auction.id, minimumBidAmount));
      return true;
    }

    if (action === 'end' && param) {
      const character = await getAuctionCharacter(prisma, interaction.user.id);

      if (!character) {
        await interaction.reply({
          content: '캐릭터를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      const auction = await getAuctionDetail(prisma, param);
      if (!auction) {
        await interaction.reply({
          content: '경매를 찾을 수 없습니다.',
          ephemeral: true,
        });
        return true;
      }

      if (auction.sellerId !== character.id) {
        await interaction.reply({
          content: '판매자만 경매를 종료할 수 있습니다.',
          ephemeral: true,
        });
        return true;
      }

      let result;
      try {
        result = await finalizeAuction({
          prisma,
          auctionId: auction.id,
          now: new Date(),
          force: true,
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ ${mapAuctionErrorToMessage(error)}`,
          ephemeral: true,
        });
        return true;
      }

      const latest = await getAuctionDetail(prisma, auction.id);

      if (latest) {
        await interaction.update({
          embeds: [createAuctionDetailEmbed(latest, character.id)],
          components: createAuctionDetailComponents(latest, character.id),
        });
      } else {
        await renderAuctionMain(interaction, {
          prisma,
          mode: 'update',
        });
      }

      const statusMessage = {
        completed: '✅ 경매를 종료했고 낙찰 정산이 완료되었습니다.',
        no_bids: '🟨 입찰이 없어 유찰 처리하고 아이템을 반환했습니다.',
        reserve_not_met: '🟨 예약가 미달로 유찰 처리하고 아이템을 반환했습니다.',
      }[result.status] || '경매 종료 처리가 완료되었습니다.';

      await interaction.followUp({
        content: statusMessage,
        ephemeral: true,
      });
      return true;
    }

    return false;
  },

  async handleAuctionSelect(interaction, { prisma }) {
    if (!interaction.customId.startsWith(`${AUCTION_BUTTON_PREFIX}select:`)) {
      return false;
    }

    const customId = interaction.customId.slice(AUCTION_BUTTON_PREFIX.length);
    const [, type] = customId.split(':');
    const selectedValue = interaction.values[0];

    if (type === 'view') {
      await renderAuctionDetail(interaction, {
        prisma,
        auctionId: selectedValue,
        mode: 'update',
      });
      return true;
    }

    if (type === 'create') {
      const equipmentId = parsePositiveInteger(selectedValue);

      if (!equipmentId) {
        await interaction.reply({
          content: '유효하지 않은 장비입니다.',
          ephemeral: true,
        });
        return true;
      }

      await interaction.showModal(createAuctionModal(equipmentId));
      return true;
    }

    return false;
  },

  async handleAuctionModal(interaction, { prisma }) {
    if (!interaction.customId.startsWith(AUCTION_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(AUCTION_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    if (action === 'createmodal') {
      const equipmentId = parsePositiveInteger(param);

      if (!equipmentId) {
        await interaction.reply({
          content: '❌ 유효하지 않은 장비입니다.',
          ephemeral: true,
        });
        return true;
      }

      const startPrice = parsePositiveInteger(interaction.fields.getTextInputValue('startPrice'));
      const durationHours = parsePositiveInteger(interaction.fields.getTextInputValue('durationHours'));
      const reserveRaw = interaction.fields.getTextInputValue('reservePrice')?.trim() || '';
      const reservePrice = reserveRaw ? parsePositiveInteger(reserveRaw) : null;

      if (!startPrice) {
        await interaction.reply({
          content: '❌ 유효한 시작가를 입력해주세요.',
          ephemeral: true,
        });
        return true;
      }

      if (!durationHours) {
        await interaction.reply({
          content: '❌ 유효한 경매 기간을 입력해주세요.',
          ephemeral: true,
        });
        return true;
      }

      let created;
      try {
        created = await createAuction({
          prisma,
          sellerUserId: interaction.user.id,
          equipmentId,
          startPrice,
          durationHours,
          reservePrice,
          now: new Date(),
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ ${mapAuctionErrorToMessage(error)}`,
          ephemeral: true,
        });
        return true;
      }

      await interaction.reply({
        content: [
          '✅ 경매 등록 완료',
          '',
          `🧾 경매 ID: #${created.id}`,
          `💰 시작가: ${formatGold(created.startPrice)}`,
          created.reservePrice ? `🏁 예약가: ${formatGold(created.reservePrice)}` : '🏁 예약가: 없음',
          `⏱️ 기간: ${Math.floor(created.duration / 3600)}시간`,
          `🕒 마감: ${formatRemainingTime(created.expiresAt)}`,
        ].join('\n'),
        ephemeral: true,
      });
      return true;
    }

    if (action === 'bidmodal') {
      const auctionId = parsePositiveInteger(param);
      const bidAmount = parsePositiveInteger(interaction.fields.getTextInputValue('bidAmount'));

      if (!auctionId || !bidAmount) {
        await interaction.reply({
          content: '❌ 유효한 입찰 정보를 입력해주세요.',
          ephemeral: true,
        });
        return true;
      }

      let result;
      try {
        result = await placeAuctionBid({
          prisma,
          bidderUserId: interaction.user.id,
          auctionId,
          bidAmount,
          now: new Date(),
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ ${mapAuctionErrorToMessage(error)}`,
          ephemeral: true,
        });
        return true;
      }

      await interaction.reply({
        content: [
          '✅ 입찰 완료',
          '',
          `💰 입찰 금액: ${formatGold(result.bid.bidAmount)}`,
          `🏷️ 이전 최고가: ${formatGold(result.previousBidAmount)}`,
          result.wasExtended
            ? `⏱️ 마감 임박 입찰로 경매가 ${result.extensionMinutes}분 연장되었습니다.`
            : '⏱️ 마감 시간은 유지됩니다.',
          '💡 `/auction`에서 최신 상태를 확인하세요.',
        ].join('\n'),
        ephemeral: true,
      });
      return true;
    }

    return false;
  },

  AUCTION_BUTTON_PREFIX,
};
