const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guildwar')
    .setDescription('Guild war commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View current guild war status'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View guild war leaderboard'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('contributions')
        .setDescription('View your guild\'s top contributors')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      return await this.showStatus(interaction);
    } else if (subcommand === 'leaderboard') {
      return await this.showLeaderboard(interaction);
    } else if (subcommand === 'contributions') {
      return await this.showContributions(interaction);
    }
  },

  async showStatus(interaction) {
    const guildWarSystem = interaction.client.guildWarSystem;

    if (!guildWarSystem) {
      return await interaction.reply({
        content: '❌ Guild war system not initialized!',
        ephemeral: true
      });
    }

    if (!guildWarSystem.activeWar) {
      return await interaction.reply({
        content: '⏳ No active guild war. Wars happen every weekend (Sat 20:00 - Sun 22:00 KST)!',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Get player's guild
      const character = await prisma.character.findUnique({
        where: { userId: interaction.user.id },
        include: { guildMember: { include: { guild: true } } }
      });

      if (!character || !character.guildMember) {
        return await interaction.editReply({
          content: '❌ You need to join a guild first! Use `/guild list` to find one.'
        });
      }

      const status = await guildWarSystem.getGuildStatus(character.guildMember.guildId);

      if (!status) {
        return await interaction.editReply({
          content: '❌ Your guild is not participating in the current war.'
        });
      }

      const now = Date.now();
      const timeLeft = status.war.endTime.getTime() - now;
      const hoursLeft = Math.floor(timeLeft / 1000 / 60 / 60);
      const minutesLeft = Math.floor((timeLeft / 1000 / 60) % 60);

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Guild War - ${status.war.season}`)
        .setDescription(
          `**Your Guild:** ${status.participant.guild.name}\n` +
          `**Rank:** #${status.rank}\n` +
          `**Score:** ${status.participant.score.toLocaleString()} points\n\n` +
          `**Time Remaining:** ${hoursLeft}h ${minutesLeft}m\n` +
          `**War Ends:** <t:${Math.floor(status.war.endTime.getTime() / 1000)}:R>`
        )
        .setColor(0xff0000)
        .setTimestamp();

      // Show contribution breakdown
      const contribBreakdown = {};
      for (const contrib of status.participant.contributions) {
        contribBreakdown[contrib.type] = (contribBreakdown[contrib.type] || 0) + contrib.points;
      }

      if (Object.keys(contribBreakdown).length > 0) {
        const breakdownText = Object.entries(contribBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([type, points]) => `• **${type.replace(/_/g, ' ')}**: ${points.toLocaleString()} pts`)
          .join('\n');

        embed.addFields({
          name: '📊 Contribution Breakdown',
          value: breakdownText
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[GuildWar] Status error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching guild war status.'
      });
    }
  },

  async showLeaderboard(interaction) {
    const guildWarSystem = interaction.client.guildWarSystem;

    if (!guildWarSystem) {
      return await interaction.reply({
        content: '❌ Guild war system not initialized!',
        ephemeral: true
      });
    }

    const leaderboard = await guildWarSystem.getLeaderboard();

    if (!leaderboard) {
      return await interaction.reply({
        content: '⏳ No active guild war. Wars happen every weekend (Sat 20:00 - Sun 22:00 KST)!',
        ephemeral: true
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const rankings = leaderboard.participants.map((p, i) => {
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      return `${medal} **${p.guild.name}** - ${p.score.toLocaleString()} points`;
    }).join('\n');

    const now = Date.now();
    const timeLeft = leaderboard.war.endTime.getTime() - now;
    const hoursLeft = Math.floor(timeLeft / 1000 / 60 / 60);
    const minutesLeft = Math.floor((timeLeft / 1000 / 60) % 60);

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Guild War Leaderboard - ${leaderboard.war.season}`)
      .setDescription(
        `**Time Remaining:** ${hoursLeft}h ${minutesLeft}m\n\n` +
        `**Rankings:**\n${rankings}\n\n` +
        `**Rewards:**\n` +
        `🥇 1st: 100,000 💰 + Legendary Chest\n` +
        `🥈 2nd: 50,000 💰 + Epic Chest\n` +
        `🥉 3rd: 25,000 💰 + Rare Chest`
      )
      .setColor(0xffd700)
      .setTimestamp()
      .setFooter({ text: 'Keep fighting for your guild!' });

    await interaction.reply({ embeds: [embed] });
  },

  async showContributions(interaction) {
    const guildWarSystem = interaction.client.guildWarSystem;

    if (!guildWarSystem) {
      return await interaction.reply({
        content: '❌ Guild war system not initialized!',
        ephemeral: true
      });
    }

    if (!guildWarSystem.activeWar) {
      return await interaction.reply({
        content: '⏳ No active guild war. Wars happen every weekend (Sat 20:00 - Sun 22:00 KST)!',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Get player's guild
      const character = await prisma.character.findUnique({
        where: { userId: interaction.user.id },
        include: { guildMember: { include: { guild: true } } }
      });

      if (!character || !character.guildMember) {
        return await interaction.editReply({
          content: '❌ You need to join a guild first! Use `/guild list` to find one.'
        });
      }

      const status = await guildWarSystem.getGuildStatus(character.guildMember.guildId);

      if (!status) {
        return await interaction.editReply({
          content: '❌ Your guild is not participating in the current war.'
        });
      }

      // Group contributions by character
      const contribMap = {};
      for (const contrib of status.participant.contributions) {
        if (!contribMap[contrib.characterId]) {
          contribMap[contrib.characterId] = {
            character: contrib.character,
            points: 0
          };
        }
        contribMap[contrib.characterId].points += contrib.points;
      }

      const topContributors = Object.values(contribMap)
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

      if (topContributors.length === 0) {
        return await interaction.editReply({
          content: '📊 No contributions yet. Be the first to contribute!'
        });
      }

      const contributorList = topContributors.map((c, i) => {
        const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
        return `${medal} **${c.character.name}** - ${c.points.toLocaleString()} pts`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`👥 ${status.participant.guild.name} - Top Contributors`)
        .setDescription(
          `**Guild Rank:** #${status.rank}\n` +
          `**Total Score:** ${status.participant.score.toLocaleString()} points\n\n` +
          `**Top 10 Contributors:**\n${contributorList}`
        )
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: 'Every action counts!' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[GuildWar] Contributions error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching contributions.'
      });
    }
  }
};
