/**
 * Trade Select Menu Handlers
 */

const { TradingSystem } = require('./trading-system');

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
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const result = await TradingSystem.addItem(userTrade.tradeId, userId, equipmentId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.update({ content: '✅ 아이템을 추가했습니다!', components: [] });
}

async function handleSelectRemoveItem(interaction) {
  const userId = interaction.user.id;
  const equipmentId = parseInt(interaction.values[0]);

  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const result = TradingSystem.removeItem(userTrade.tradeId, userId, equipmentId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.update({ content: '✅ 아이템을 제거했습니다!', components: [] });
}

module.exports = {
  TRADE_SELECT_PREFIX,
  isTradeSelect,
  handleTradeSelect
};
