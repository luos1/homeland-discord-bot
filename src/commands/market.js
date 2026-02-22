const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { RESOURCES } = require('../game/production-classes');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const MARKET_BUTTON_PREFIX = 'market:';
const MARKET_FEE_RATE = 0.1; // 10% 수수료

function createMarketMainEmbed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🏪 거래소')
    .setDescription(
      [
        createDivider(),
        '**플레이어 간 거래소**',
        '',
        '📦 자원과 장비를 사고팔 수 있습니다',
        '💰 거래 수수료: 10%',
        '',
        '🔍 **거래소 메뉴**',
        '📦 자원 거래소 - 채집 자원 매매',
        '⚔️ 장비 거래소 - 장비 매매 (미구현)',
        '📊 내 등록 목록 - 판매 중인 아이템',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '아래 버튼으로 거래소를 이용하세요',
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
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true), // 미구현
    new ButtonBuilder()
      .setCustomId(`${MARKET_BUTTON_PREFIX}mylistings`)
      .setLabel('내 등록')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Success),
  );
}

function createResourceMarketEmbed(listings, page = 0) {
  const pageSize = 10;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageListings = listings.slice(start, end);

  const listingLines = pageListings.map((listing, index) => {
    const resource = RESOURCES[listing.itemKey];
    const emoji = resource?.emoji || '📦';
    const totalPrice = listing.pricePerUnit * listing.quantity;

    return `${start + index + 1}. ${emoji} **${listing.itemName}** x${listing.quantity}\n   ${listing.pricePerUnit}G/개 | 총 ${totalPrice}G`;
  });

  const totalPages = Math.ceil(listings.length / pageSize);

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('📦 자원 거래소')
    .setDescription(
      [
        createDivider(),
        `📊 등록 수: ${listings.length}개 | 페이지: ${page + 1}/${totalPages || 1}`,
        '',
        listingLines.length > 0 ? listingLines.join('\n\n') : '등록된 자원이 없습니다',
        '',
        createDivider(),
        '',
        '💡 구매하려면 번호를 선택하세요',
        '💡 판매하려면 "등록" 버튼을 누르세요',
      ].join('\n'),
    )
    .setFooter({
      text: '거래 수수료 10% (판매자 부담)',
    });
}

function createResourceMarketActionRow(listings, page = 0) {
  const pageSize = 10;
  const start = page * pageSize;
  const pageListings = listings.slice(start, pageSize);

  const selectOptions = pageListings.map((listing, index) => {
    const resource = RESOURCES[listing.itemKey];
    const emoji = resource?.emoji || '📦';
    const totalPrice = listing.pricePerUnit * listing.quantity;

    return {
      label: `${listing.itemName} x${listing.quantity}`,
      description: `${listing.pricePerUnit}G/개 | 총 ${totalPrice}G`,
      value: `${listing.id}`,
      emoji: emoji,
    };
  });

  const components = [];

  if (selectOptions.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${MARKET_BUTTON_PREFIX}buy:resource`)
          .setPlaceholder('구매할 자원을 선택하세요')
          .addOptions(selectOptions),
      ),
    );
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}sell:resource`)
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

  return components;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('플레이어 간 거래소를 이용합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

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
  },

  async handleMarketButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(MARKET_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        resources: true,
        marketListings: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    // 뒤로가기
    if (action === 'back') {
      await interaction.update({
        embeds: [createMarketMainEmbed()],
        components: [createMarketMainActionRow()],
      });

      return true;
    }

    // 자원 거래소 보기
    if (action === 'resources') {
      const listings = await prisma.marketListing.findMany({
        where: {
          status: 'active',
          itemType: 'resource',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      await interaction.update({
        embeds: [createResourceMarketEmbed(listings)],
        components: createResourceMarketActionRow(listings),
      });

      return true;
    }

    // 내 등록 목록
    if (action === 'mylistings') {
      const myListings = character.marketListings.filter((l) => l.status === 'active');

      const listingLines = myListings.map((listing, index) => {
        const resource = RESOURCES[listing.itemKey];
        const emoji = resource?.emoji || '📦';
        const totalPrice = listing.pricePerUnit * listing.quantity;
        const fee = Math.floor(totalPrice * MARKET_FEE_RATE);
        const netProfit = totalPrice - fee;

        return `${index + 1}. ${emoji} **${listing.itemName}** x${listing.quantity}\n   ${listing.pricePerUnit}G/개 | 총 ${totalPrice}G (수수료 -${fee}G = ${netProfit}G)`;
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('📊 내 등록 목록')
        .setDescription(
          [
            createDivider(),
            `📦 등록 중: ${myListings.length}개`,
            '',
            listingLines.length > 0 ? listingLines.join('\n\n') : '등록한 아이템이 없습니다',
            '',
            createDivider(),
          ].join('\n'),
        )
        .setFooter({
          text: '취소하려면 번호를 선택하세요',
        });

      const components = [];

      if (myListings.length > 0) {
        const selectOptions = myListings.slice(0, 25).map((listing, index) => {
          const resource = RESOURCES[listing.itemKey];
          const emoji = resource?.emoji || '📦';

          return {
            label: `${listing.itemName} x${listing.quantity}`,
            description: `${listing.pricePerUnit}G/개`,
            value: `${listing.id}`,
            emoji: emoji,
          };
        });

        components.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${MARKET_BUTTON_PREFIX}cancel`)
              .setPlaceholder('취소할 등록을 선택하세요')
              .addOptions(selectOptions),
          ),
        );
      }

      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`${MARKET_BUTTON_PREFIX}back`)
            .setLabel('뒤로')
            .setEmoji('🔙')
            .setStyle(ButtonStyle.Secondary),
        ),
      );

      await interaction.update({
        embeds: [embed],
        components,
      });

      return true;
    }

    // 자원 등록 (선택 메뉴)
    if (action === 'sell' && param === 'resource') {
      if (character.resources.length === 0) {
        await interaction.reply({
          content: '❌ 판매할 자원이 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      const resourceOptions = character.resources
        .filter((r) => r.quantity > 0)
        .slice(0, 25)
        .map((r) => {
          const resource = RESOURCES[r.type];
          return {
            label: `${r.name} (${r.quantity}개)`,
            description: `보유: ${r.quantity}개`,
            value: r.type,
            emoji: resource?.emoji || '📦',
          };
        });

      if (resourceOptions.length === 0) {
        await interaction.reply({
          content: '❌ 판매할 자원이 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLORS.profile)
            .setTitle('💰 자원 등록')
            .setDescription(
              [
                createDivider(),
                '판매할 자원을 선택하세요',
                '',
                '💡 선택 후 수량과 가격을 입력합니다',
                '💡 수수료 10%가 차감됩니다',
                '',
                createDivider(),
              ].join('\n'),
            ),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${MARKET_BUTTON_PREFIX}sellselect:resource`)
              .setPlaceholder('판매할 자원 선택')
              .addOptions(resourceOptions),
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${MARKET_BUTTON_PREFIX}resources`)
              .setLabel('뒤로')
              .setEmoji('🔙')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });

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

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        resources: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    // 구매
    if (action === 'buy') {
      const listingId = parseInt(selectedValue);
      const listing = await prisma.marketListing.findUnique({
        where: { id: listingId },
      });

      if (!listing || listing.status !== 'active') {
        await interaction.reply({
          content: '❌ 이미 판매된 상품이거나 존재하지 않습니다.',
          ephemeral: true,
        });

        return true;
      }

      if (listing.sellerId === character.id) {
        await interaction.reply({
          content: '❌ 자신이 등록한 상품은 구매할 수 없습니다.',
          ephemeral: true,
        });

        return true;
      }

      const totalPrice = listing.pricePerUnit * listing.quantity;

      if (character.gold < totalPrice) {
        await interaction.reply({
          content: `❌ 골드가 부족합니다. (필요: ${totalPrice}G, 보유: ${character.gold}G)`,
          ephemeral: true,
        });

        return true;
      }

      // 거래 처리
      await prisma.$transaction(async (tx) => {
        // 구매자 골드 차감
        await tx.character.update({
          where: { id: character.id },
          data: {
            gold: character.gold - totalPrice,
          },
        });

        // 판매자 골드 추가 (수수료 차감)
        const fee = Math.floor(totalPrice * MARKET_FEE_RATE);
        const netProfit = totalPrice - fee;

        await tx.character.update({
          where: { id: listing.sellerId },
          data: {
            gold: {
              increment: netProfit,
            },
          },
        });

        // 구매자에게 자원 추가
        const existingResource = await tx.resource.findUnique({
          where: {
            characterId_type: {
              characterId: character.id,
              type: listing.itemKey,
            },
          },
        });

        if (existingResource) {
          await tx.resource.update({
            where: { id: existingResource.id },
            data: {
              quantity: existingResource.quantity + listing.quantity,
            },
          });
        } else {
          await tx.resource.create({
            data: {
              characterId: character.id,
              type: listing.itemKey,
              name: listing.itemName,
              quantity: listing.quantity,
            },
          });
        }

        // 등록 상태 변경
        await tx.marketListing.update({
          where: { id: listingId },
          data: {
            status: 'sold',
            soldAt: new Date(),
            buyerId: character.id,
          },
        });

        // 거래 기록
        await tx.tradeHistory.create({
          data: {
            sellerId: listing.sellerId,
            buyerId: character.id,
            itemType: listing.itemType,
            itemKey: listing.itemKey,
            itemName: listing.itemName,
            quantity: listing.quantity,
            price: totalPrice,
            fee,
          },
        });
      });

      await interaction.reply({
        content: [
          '✅ 구매 완료!',
          '',
          `${RESOURCES[listing.itemKey]?.emoji || '📦'} **${listing.itemName}** x${listing.quantity}`,
          `💰 ${totalPrice}G 지불`,
          '',
          `남은 골드: ${character.gold - totalPrice}G`,
        ].join('\n'),
        ephemeral: true,
      });

      return true;
    }

    // 취소
    if (action === 'cancel') {
      const listingId = parseInt(selectedValue);
      const listing = await prisma.marketListing.findUnique({
        where: { id: listingId },
      });

      if (!listing || listing.sellerId !== character.id) {
        await interaction.reply({
          content: '❌ 취소할 수 없는 등록입니다.',
          ephemeral: true,
        });

        return true;
      }

      // 취소 처리: 자원 반환
      await prisma.$transaction(async (tx) => {
        // 자원 반환
        const existingResource = await tx.resource.findUnique({
          where: {
            characterId_type: {
              characterId: character.id,
              type: listing.itemKey,
            },
          },
        });

        if (existingResource) {
          await tx.resource.update({
            where: { id: existingResource.id },
            data: {
              quantity: existingResource.quantity + listing.quantity,
            },
          });
        } else {
          await tx.resource.create({
            data: {
              characterId: character.id,
              type: listing.itemKey,
              name: listing.itemName,
              quantity: listing.quantity,
            },
          });
        }

        // 등록 취소
        await tx.marketListing.update({
          where: { id: listingId },
          data: {
            status: 'cancelled',
          },
        });
      });

      await interaction.reply({
        content: [
          '✅ 등록 취소!',
          '',
          `${RESOURCES[listing.itemKey]?.emoji || '📦'} **${listing.itemName}** x${listing.quantity} 반환`,
        ].join('\n'),
        ephemeral: true,
      });

      return true;
    }

    // 자원 판매 선택 (모달 띄우기)
    if (action === 'sellselect' && param === 'resource') {
      const resourceType = selectedValue;
      const resource = character.resources.find((r) => r.type === resourceType);

      if (!resource || resource.quantity === 0) {
        await interaction.reply({
          content: '❌ 해당 자원을 보유하고 있지 않습니다.',
          ephemeral: true,
        });

        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId(`${MARKET_BUTTON_PREFIX}sellmodal:${resourceType}`)
        .setTitle(`${resource.name} 판매 등록`);

      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel(`판매 수량 (최대 ${resource.quantity}개)`)
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

      await interaction.showModal(modal);

      return true;
    }

    return false;
  },

  async handleMarketModal(interaction, { prisma }) {
    if (!interaction.customId.startsWith(MARKET_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(MARKET_BUTTON_PREFIX.length);
    const [action, resourceType] = customId.split(':');

    if (action !== 'sellmodal') {
      return false;
    }

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        resources: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    const resource = character.resources.find((r) => r.type === resourceType);

    if (!resource || resource.quantity === 0) {
      await interaction.reply({
        content: '❌ 해당 자원을 보유하고 있지 않습니다.',
        ephemeral: true,
      });

      return true;
    }

    const quantity = parseInt(interaction.fields.getTextInputValue('quantity'));
    const pricePerUnit = parseInt(interaction.fields.getTextInputValue('price'));

    if (isNaN(quantity) || quantity <= 0) {
      await interaction.reply({
        content: '❌ 유효한 수량을 입력하세요.',
        ephemeral: true,
      });

      return true;
    }

    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      await interaction.reply({
        content: '❌ 유효한 가격을 입력하세요.',
        ephemeral: true,
      });

      return true;
    }

    if (quantity > resource.quantity) {
      await interaction.reply({
        content: `❌ 수량이 부족합니다. (보유: ${resource.quantity}개)`,
        ephemeral: true,
      });

      return true;
    }

    const totalPrice = pricePerUnit * quantity;
    const fee = Math.floor(totalPrice * MARKET_FEE_RATE);
    const netProfit = totalPrice - fee;

    // 거래소 등록
    await prisma.$transaction(async (tx) => {
      // 자원 차감
      await tx.resource.update({
        where: { id: resource.id },
        data: {
          quantity: resource.quantity - quantity,
        },
      });

      // 거래소 등록
      await tx.marketListing.create({
        data: {
          sellerId: character.id,
          itemType: 'resource',
          itemKey: resourceType,
          itemName: resource.name,
          quantity,
          pricePerUnit,
          totalPrice,
          status: 'active',
        },
      });
    });

    await interaction.reply({
      content: [
        '✅ 거래소에 등록했습니다!',
        '',
        `${RESOURCES[resourceType]?.emoji || '📦'} **${resource.name}** x${quantity}`,
        `💰 ${pricePerUnit}G/개 | 총 ${totalPrice}G`,
        `📊 판매 시 수수료 10% 차감 (${fee}G)`,
        `💵 실수령액: ${netProfit}G`,
        '',
        '💡 `/market`에서 판매 현황을 확인하세요',
      ].join('\n'),
      ephemeral: true,
    });

    return true;
  },

  MARKET_BUTTON_PREFIX,
  MARKET_FEE_RATE,
};
