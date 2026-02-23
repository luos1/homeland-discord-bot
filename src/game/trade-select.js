/**
 * Trade Select Menu Handlers
 */

const { TradingSystem } = require('./trading-system');
const { EmbedBuilder } = require('discord.js');

const TRADE_SELECT_PREFIX = 'trade_select_';

function isTradeSelect(customId) {
  return customId.startsWith(TRADE_SELECT_PREFIX);
}

async function handleTradeSelect(interaction) {
  const customId = interaction.customId;

  if (customId === 'trade_select_item') {
    return await handleSelectItem(interaction);
  }

  if (customId === 'trade_select_remove_item') {
    return await handleSelectRemoveItem(interaction);
  }

  return interaction.reply({ content: '알 수 없는 선택입니다.', ephemeral: true });
}

async function handleSelectItem(interaction) {
  const userId = interaction.user.id;
  const equipmentId = parseInt(interaction.values[0]);

  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.update({ content: '❌ 진행 중인 거래가 없습니다.', components: [] });
  }

  const result = await TradingSystem.addItem(userTrade.tradeId, userId, equipmentId);

  if (!result.success) {
    return interaction.update({ content: `❌ ${result.error}`, components: [] });
  }

  await interaction.update({ content: '✅ 아이템이 추가되었습니다!', components: [] });
}

async function handleSelectRemoveItem(interaction) {
  const userId = interaction.user.id;
  const equipmentId = parseInt(interaction.values[0]);

  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.update({ content: '❌ 진행 중인 거래가 없습니다.', components: [] });
  }

  const result = TradingSystem.removeItem(userTrade.tradeId, userId, equipmentId);

  if (!result.success) {
    return interaction.update({ content: `❌ ${result.error}`, components: [] });
  }

  await interaction.update({ content: '✅ 아이템이 제거되었습니다!', components: [] });
}

module.exports = {
  TRADE_SELECT_PREFIX,
  isTradeSelect,
  handleTradeSelect
};
