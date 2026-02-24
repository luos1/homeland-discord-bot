/**
 * Guild Manage Button Handlers
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { GuildSystem } = require('./guild-system');
const { hireNPC, fireNPC, NPC_WEEKLY_FEE } = require('./guild-city');

const prisma = new PrismaClient();

async function handleGuildManageButton(interaction, { prisma }) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  if (guild.masterId !== userId) {
    return interaction.reply({ content: '❌ 길드장만 관리할 수 있습니다.', ephemeral: true });
  }

  const hasNPC = guild.npcs && guild.npcs.length > 0;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`⚙️ 길드 관리 - ${guild.name}`)
    .setDescription(
      [
        createDivider(),
        `💰 길드 자금: ${guild.gold.toLocaleString()}G`,
        `👥 멤버: ${guild.members.length}/${guild.maxMembers}명`,
        '',
        hasNPC ? '🏛️ **NPC 상인 임대 중**' : '🏛️ NPC 상인 미임대',
        hasNPC ? `만료일: ${new Date(guild.npcs[0].expiresAt).toLocaleDateString('ko-KR')}` : '',
        '',
        createDivider(),
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [];

  if (!hasNPC) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('guild_hire_npc')
        .setLabel(`NPC 임대 (${(NPC_WEEKLY_FEE / 1000).toFixed(0)}K)`)
        .setEmoji('🏛️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(guild.gold < NPC_WEEKLY_FEE)
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('guild_fire_npc')
        .setLabel('NPC 해고')
        .setEmoji('🔥')
        .setStyle(ButtonStyle.Danger)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('guild_info')
      .setLabel('길드로')
      .setEmoji('🏰')
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.update({ embeds: [embed], components: rows });
}

async function handleGuildHireNPC(interaction, { prisma }) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await hireNPC(guild.id, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

async function handleGuildFireNPC(interaction, { prisma }) {
  const userId = interaction.user.id;
  const guild = await GuildSystem.getUserGuild(userId);

  if (!guild) {
    return interaction.reply({ content: '❌ 길드에 소속되어 있지 않습니다.', ephemeral: true });
  }

  const result = await fireNPC(guild.id, userId);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({ content: result.message, ephemeral: true });
}

module.exports = {
  handleGuildManageButton,
  handleGuildHireNPC,
  handleGuildFireNPC,
};
