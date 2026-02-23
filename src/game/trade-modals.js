/**
 * Trade Modal Handlers
 */

const { TradingSystem } = require('./trading-system');

const TRADE_MODAL_PREFIX = 'trade_';

function isTradeModal(customId) {
  return customId.startsWith(TRADE_MODAL_PREFIX) && customId.includes('modal');
}

async function handleTradeModal(interaction) {
  const customId = interaction.customId;

  if (customId === 'trade_set_gold_modal') {
    return await handleSetGoldModal(interaction);
  }

  return interaction.reply({ content: '알 수 없는 모달입니다.', ephemeral: true });
}

async function handleSetGoldModal(interaction) {
  const userId = interaction.user.id;
  const goldStr = interaction.fields.getTextInputValue('gold_amount');
  const gold = parseInt(goldStr);

  if (isNaN(gold) || gold < 0) {
    return interaction.reply({ content: '❌ 올바른 골드 수량을 입력하세요.', ephemeral: true });
  }

  const userTrade = TradingSystem.getUserTrade(userId);

  if (!userTrade) {
    return interaction.reply({ content: '❌ 진행 중인 거래가 없습니다.', ephemeral: true });
  }

  const result = await TradingSystem.setGold(userTrade.tradeId, userId, gold);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ 골드를 ${gold.toLocaleString()}로 설정했습니다!`, ephemeral: true });
}

module.exports = {
  TRADE_MODAL_PREFIX,
  isTradeModal,
  handleTradeModal
};
