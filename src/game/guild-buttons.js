/**
 * Guild Button Handlers
 */

const { GuildSystem } = require('./guild-system');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const GUILD_BUTTON_PREFIX = 'guild_';

function isGuildButton(customId) {
  return customId.startsWith(GUILD_BUTTON_PREFIX);
}

async function handleGuildButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('guild_donate_')) {
    return await handleDonateButton(interaction);
  }

  if (customId.startsWith('guild_leave_')) {
    return await handleLeaveButton(interaction);
  }

  if (customId.startsWith('guild_disband_confirm_')) {
    return await handleDisbandConfirmButton(interaction);
  }

  if (customId === 'guild_disband_cancel') {
    return await interaction.update({ content: '❌ 취소되었습니다.', embeds: [], components: [] });
  }

  return interaction.reply({ content: '알 수 없는 버튼입니다.', ephemeral: true });
}

async function handleDonateButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('guild_donate_modal')
    .setTitle('길드 골드 기부');

  const goldInput = new TextInputBuilder()
    .setCustomId('gold_amount')
    .setLabel('기부할 골드')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1000')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(goldInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleLeaveButton(interaction) {
  const userId = interaction.user.id;
  const result = await GuildSystem.leaveGuild(userId);

  if (!result.success) {
    return await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.update({ content: '✅ 길드를 탈퇴했습니다.', embeds: [], components: [] });
}

async function handleDisbandConfirmButton(interaction) {
  const userId = interaction.user.id;
  const guildId = parseInt(interaction.customId.split('_').pop());

  const result = await GuildSystem.disbandGuild(guildId, userId);

  if (!result.success) {
    return await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.update({ content: '✅ 길드를 해체했습니다.', embeds: [], components: [] });
}

module.exports = {
  GUILD_BUTTON_PREFIX,
  isGuildButton,
  handleGuildButton
};
