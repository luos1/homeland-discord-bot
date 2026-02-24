/**
 * Guild City Button Handlers
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const {
  getCityInfo,
  contribute,
  buyItem,
  createCityMainEmbed,
  createCityMainButtons,
} = require('./guild-city');
const { getCityItem, getAllCityItems, getMaterialInfo } = require('./guild-city-items');
const { GuildSystem } = require('./guild-system');

const prisma = new PrismaClient();

async function handleCityButton(interaction, { prisma }) {
  const customId = interaction.customId;

  // 도시 메인
  if (customId === 'city_main') {
    return await handleCityMain(interaction);
  }

  // 상점
  if (customId === 'city_shop') {
    return await handleCityShop(interaction);
  }

  // 재료 납품
  if (customId === 'city_contribute') {
    return await handleCityContribute(interaction);
  }

  // 구매
  if (customId.startsWith('city_buy:')) {
    return await handleCityBuy(interaction);
  }

  // 납품 확인
  if (customId.startsWith('city_contrib:')) {
    return await handleCityContribConfirm(interaction);
  }

  return interaction.reply({ content: '알 수 없는 도시 버튼입니다.', ephemeral: true });
}

// ===== 도시 메인 =====

async function handleCityMain(interaction) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const cityInfo = await getCityInfo(guild.id);

  if (!cityInfo) {
    return interaction.reply({ content: '❌ 임대한 NPC가 없습니다.', ephemeral: true });
  }

  const embed = createCityMainEmbed(cityInfo);
  const buttons = createCityMainButtons();

  await interaction.update({ embeds: [embed], components: buttons });
}

// ===== 상점 =====

async function handleCityShop(interaction) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const cityInfo = await getCityInfo(guild.id);

  if (!cityInfo) {
    return interaction.reply({ content: '❌ 임대한 NPC가 없습니다.', ephemeral: true });
  }

  const npc = cityInfo.npc;
  const items = getAllCityItems();
  const shopItems = await prisma.nPCShopItem.findMany({
    where: { npcId: npc.id },
  });

  const stockMap = new Map(shopItems.map(item => [item.itemKey, item.stock]));

  const itemLines = items.map((item, index) => {
    const stock = stockMap.get(item.key) || 0;
    const price = item.memberPrice;
    const stockText = stock > 0 ? `재고 ${stock}` : '품절';

    return [
      `${index + 1}. ${item.emoji} **${item.name}**`,
      `   💰 ${price.toLocaleString()}G | ${stockText}`,
      `   ${item.description}`,
    ].join('\n');
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🏪 ${guild.name}의 상점`)
    .setDescription(
      [
        createDivider(),
        ...itemLines,
        '',
        createDivider(),
        '💡 회원 할인가격으로 구매하세요!',
      ].join('\n')
    );

  const buttons = [];
  const availableItems = items.filter((item) => (stockMap.get(item.key) || 0) > 0);

  for (let i = 0; i < Math.min(availableItems.length, 5); i++) {
    const item = availableItems[i];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`city_buy:${item.key}`)
        .setLabel(`${i + 1}. 구매`)
        .setEmoji(item.emoji)
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('city_main')
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.update({ embeds: [embed], components: rows });
}

// ===== 재료 납품 =====

async function handleCityContribute(interaction) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const cityInfo = await getCityInfo(guild.id);

  if (!cityInfo) {
    return interaction.reply({ content: '❌ 임대한 NPC가 없습니다.', ephemeral: true });
  }

  const character = await prisma.character.findUnique({
    where: { userId },
    include: { resources: true },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const items = getAllCityItems();
  const resourceMap = new Map(character.resources.map(r => [r.type, r.quantity]));

  const itemLines = items.map((item, index) => {
    const materialsText = item.materials.map(m => {
      const have = resourceMap.get(m.type) || 0;
      const emoji = getMaterialInfo(m.type).emoji;
      const status = have >= m.qty ? '✅' : '❌';
      return `${status} ${emoji} ${m.name} ${have}/${m.qty}`;
    }).join(', ');

    return [
      `${index + 1}. ${item.emoji} **${item.name}**`,
      `   ${materialsText}`,
      `   → 생성: x${item.outputQty}`,
    ].join('\n');
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`📦 재료 납품`)
    .setDescription(
      [
        createDivider(),
        ...itemLines,
        '',
        createDivider(),
        '💡 재료를 납품하여 상품을 생성하세요',
      ].join('\n')
    );

  const buttons = [];

  for (let i = 0; i < Math.min(items.length, 5); i++) {
    const item = items[i];
    const canContribute = item.materials.every(m => (resourceMap.get(m.type) || 0) >= m.qty);

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`city_contrib:${item.key}`)
        .setLabel(`${i + 1}. 납품`)
        .setEmoji(item.emoji)
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canContribute)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('city_main')
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.update({ embeds: [embed], components: rows });
}

// ===== 구매 확인 =====

async function handleCityBuy(interaction) {
  const userId = interaction.user.id;
  const itemKey = interaction.customId.split(':')[1];

  const guild = await GuildSystem.getUserGuild(userId);
  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const cityInfo = await getCityInfo(guild.id);
  if (!cityInfo) {
    return interaction.reply({ content: '❌ 임대한 NPC가 없습니다.', ephemeral: true });
  }

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const result = await buyItem(cityInfo.npc.id, character.id, itemKey, true);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

// ===== 납품 확인 =====

async function handleCityContribConfirm(interaction) {
  const userId = interaction.user.id;
  const itemKey = interaction.customId.split(':')[1];

  const guild = await GuildSystem.getUserGuild(userId);
  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const cityInfo = await getCityInfo(guild.id);
  if (!cityInfo) {
    return interaction.reply({ content: '❌ 임대한 NPC가 없습니다.', ephemeral: true });
  }

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const result = await contribute(cityInfo.npc.id, character.id, itemKey);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

module.exports = {
  handleCityButton,
};
