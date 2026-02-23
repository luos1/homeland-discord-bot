/**
 * Guild Modal Handlers
 */

const { GuildSystem } = require('./guild-system');

const GUILD_MODAL_PREFIX = 'guild_';

function isGuildModal(customId) {
  return customId.startsWith(GUILD_MODAL_PREFIX);
}

async function handleGuildModal(interaction) {
  const customId = interaction.customId;

  if (customId === 'guild_donate_modal') {
    return await handleDonateModal(interaction);
  }

  return interaction.reply({ content: '알 수 없는 모달입니다.', ephemeral: true });
}

async function handleDonateModal(interaction) {
  const goldStr = interaction.fields.getTextInputValue('gold_amount');
  const gold = parseInt(goldStr);

  if (isNaN(gold) || gold < 1) {
    return await interaction.reply({ content: '❌ 올바른 골드 수량을 입력하세요.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const result = await GuildSystem.contributeGold(userId, gold);

  if (!result.success) {
    return await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ 길드에 ${gold.toLocaleString()} 골드를 기부했습니다!`, ephemeral: true });
}

module.exports = {
  GUILD_MODAL_PREFIX,
  isGuildModal,
  handleGuildModal
};
