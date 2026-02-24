const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guildwar')
    .setNameLocalizations({ ko: '길드전' })
    .setDescription('길드전 명령어')
    .setDescriptionLocalizations({ ko: '길드전 명령어' })
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setNameLocalizations({ ko: '상태' })
        .setDescription('현재 길드전 상태 확인')
        .setDescriptionLocalizations({ ko: '현재 길드전 상태 확인' }))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setNameLocalizations({ ko: '순위' })
        .setDescription('길드전 순위 확인')
        .setDescriptionLocalizations({ ko: '길드전 순위 확인' }))
    .addSubcommand(subcommand =>
      subcommand
        .setName('contributions')
        .setNameLocalizations({ ko: '기여도' })
        .setDescription('길드 기여도 순위 확인')
        .setDescriptionLocalizations({ ko: '길드 기여도 순위 확인' })),

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
        content: '❌ 길드전 시스템이 초기화되지 않았습니다!',
        ephemeral: true
      });
    }

    if (!guildWarSystem.activeWar) {
      return await interaction.reply({
        content: '⏳ 현재 진행 중인 길드전이 없습니다. 길드전은 매주 주말 (토 20:00 - 일 22:00 KST)에 진행됩니다!',
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
          content: '❌ 먼저 길드에 가입해주세요! `/guild list`로 길드를 찾아보세요.'
        });
      }

      const status = await guildWarSystem.getGuildStatus(character.guildMember.guildId);

      if (!status) {
        return await interaction.editReply({
          content: '❌ 현재 길드전에 참가하고 있지 않습니다.'
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
        content: '❌ 길드전 상태를 불러오는 중 오류가 발생했습니다.'
      });
    }
  },

  async showLeaderboard(interaction) {
    const guildWarSystem = interaction.client.guildWarSystem;

    if (!guildWarSystem) {
      return await interaction.reply({
        content: '❌ 길드전 시스템이 초기화되지 않았습니다!',
        ephemeral: true
      });
    }

    const leaderboard = await guildWarSystem.getLeaderboard();

    if (!leaderboard) {
      return await interaction.reply({
        content: '⏳ 현재 진행 중인 길드전이 없습니다. 길드전은 매주 주말 (토 20:00 - 일 22:00 KST)에 진행됩니다!',
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
      .setFooter({ text: '길드를 위해 계속 싸워주세요!' });

    await interaction.reply({ embeds: [embed] });
  },

  async showContributions(interaction) {
    const guildWarSystem = interaction.client.guildWarSystem;

    if (!guildWarSystem) {
      return await interaction.reply({
        content: '❌ 길드전 시스템이 초기화되지 않았습니다!',
        ephemeral: true
      });
    }

    if (!guildWarSystem.activeWar) {
      return await interaction.reply({
        content: '⏳ 현재 진행 중인 길드전이 없습니다. 길드전은 매주 주말 (토 20:00 - 일 22:00 KST)에 진행됩니다!',
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
          content: '❌ 먼저 길드에 가입해주세요! `/guild list`로 길드를 찾아보세요.'
        });
      }

      const status = await guildWarSystem.getGuildStatus(character.guildMember.guildId);

      if (!status) {
        return await interaction.editReply({
          content: '❌ 현재 길드전에 참가하고 있지 않습니다.'
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
          content: '📊 아직 기여 기록이 없습니다. 첫 번째 기여자가 되어보세요!'
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
        .setFooter({ text: '모든 행동이 중요합니다!' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[GuildWar] Contributions error:', error);
      await interaction.editReply({
        content: '❌ 기여도를 불러오는 중 오류가 발생했습니다.'
      });
    }
  }
};
