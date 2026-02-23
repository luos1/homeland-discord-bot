/**
 * Trade Button Handlers
 */

const { TradingSystem } = require('./trading-system');
const { prisma } = require('../database/prisma');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const TRADE_BUTTON_PREFIX = 'trade_';

function isTradeButton(customId) {
  return customId.startsWith(TRADE_BUTTON_PREFIX);
}

async function handleTradeButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('trade_add_item_')) {
    return await handleAddItemButton(interaction);
  }

  if (customId.startsWith('trade_remove_item_')) {
    return await handleRemoveItemButton(interaction);
  }

  if (customId.startsWith('trade_set_gold_')) {
    return await handleSetGoldButton(interaction);
  }

  if (customId.startsWith('trade_confirm_')) {
    return await handleConfirmButton(interaction);
  }

  if (customId.startsWith('trade_cancel_')) {
    return await handleCancelButton(interaction);
  }

  return interaction.reply({ content: '알 수 없는 버튼입니다.', ephemeral: true });
}

async function handleAddItemButton(interaction) {
  const userId = interaction.user.id;

  // 유저 장비 조회
  const character = await prisma.character.findUnique({
    where: { userId },
    include: {
      equipment: {
        where: { isEquipped: false }, // 장착 안 한 것만
        take: 25
      }
    }
  });

  if (!character || character.equipment.length === 0) {
    return interaction.reply({ content: '❌ 거래할 수 있는 아이템이 없습니다.', ephemeral: true });
  }

  // Select Menu로 아이템 선택
  const options = character.equipment.map(equip => ({
    label: `${equip.name} (${equip.tier})`,
    value: `${equip.id}`,
    description: `공격: ${equip.attack || 0} | 방어: ${equip.defense || 0}`
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('trade_select_item')
    .setPlaceholder('거래할 아이템 선택')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({ content: '거래할 아이템을 선택하세요:', components: [row], ephemeral: true });
}

async function handleRemoveItemButton(interaction) {
  const userId = interaction.user.id;
  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const { trade } = userTrade;
  const isUser1 = trade.user1.userId === userId;
  const myData = isUser1 ? trade.user1 : trade.user2;

  if (myData.items.length === 0) {
    return interaction.reply({ content: '❌ 제거할 아이템이 없습니다.', ephemeral: true });
  }

  const options = myData.items.map(item => ({
    label: `${item.name} (${item.tier})`,
    value: `${item.id}`
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('trade_select_remove_item')
    .setPlaceholder('제거할 아이템 선택')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({ content: '제거할 아이템을 선택하세요:', components: [row], ephemeral: true });
}

async function handleSetGoldButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('trade_set_gold_modal')
    .setTitle('골드 설정');

  const goldInput = new TextInputBuilder()
    .setCustomId('gold_amount')
    .setLabel('제공할 골드')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1000')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(goldInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleConfirmButton(interaction) {
  const userId = interaction.user.id;
  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const result = await TradingSystem.confirmTrade(userTrade.tradeId, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  if (result.waitingForOther) {
    return interaction.reply({ content: '✅ 거래를 확인했습니다. 상대방의 확인을 기다리는 중...', ephemeral: true });
  }

  // 거래 완료!
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🎉 거래 완료!')
    .setDescription('거래가 성공적으로 완료되었습니다!')
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });
}

async function handleCancelButton(interaction) {
  const userId = interaction.user.id;
  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const result = TradingSystem.cancelTrade(userTrade.tradeId, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.update({ content: '✅ 거래가 취소되었습니다.', embeds: [], components: [] });
}

module.exports = {
  TRADE_BUTTON_PREFIX,
  isTradeButton,
  handleTradeButton
};
