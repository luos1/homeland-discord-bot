const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, createDivider } = require('./ui');

function createInfoEmbed({ title, description, footer = null }) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(title)
    .setDescription(description);

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.defeat)
    .setTitle('❌ 오류')
    .setDescription(message);
}

function createSuccessEmbed({ title = '✅ 성공', description }) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.victory)
    .setTitle(title)
    .setDescription(description);
}

function createWarningEmbed({ title = '⚠️ 경고', description }) {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(title)
    .setDescription(description);
}

module.exports = {
  createInfoEmbed,
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed,
};
