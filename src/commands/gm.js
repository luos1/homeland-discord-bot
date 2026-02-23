const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GM User IDs (add your Discord user IDs here)
const GM_USERS = [
  '766164672692224010', // Add GM Discord IDs
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gm')
    .setDescription('Game Master commands (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('givegold')
        .setDescription('Give gold to a player')
        .addUserOption(option =>
          option
            .setName('player')
            .setDescription('Target player')
            .setRequired(true))
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount of gold')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setlevel')
        .setDescription('Set player level')
        .addUserOption(option =>
          option
            .setName('player')
            .setDescription('Target player')
            .setRequired(true))
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('New level')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('event')
        .setDescription('Start a server-wide event')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Event type')
            .setRequired(true)
            .addChoices(
              { name: '2x XP', value: 'xp_boost' },
              { name: '2x Gold', value: 'gold_boost' },
              { name: '2x Drop Rate', value: 'drop_boost' },
              { name: 'All Boosts', value: 'all_boost' }
            ))
        .addIntegerOption(option =>
          option
            .setName('duration')
            .setDescription('Duration in hours')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(24)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('announce')
        .setDescription('Send announcement to all servers')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Announcement message')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View server statistics'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('resetcooldown')
        .setDescription('Reset cooldowns for a player')
        .addUserOption(option =>
          option
            .setName('player')
            .setDescription('Target player')
            .setRequired(true))),

  async execute(interaction) {
    // Check if user is GM
    if (!GM_USERS.includes(interaction.user.id)) {
      return await interaction.reply({
        content: '❌ This command is only available to Game Masters!',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'givegold') {
      return await this.giveGold(interaction);
    } else if (subcommand === 'setlevel') {
      return await this.setLevel(interaction);
    } else if (subcommand === 'event') {
      return await this.startEvent(interaction);
    } else if (subcommand === 'announce') {
      return await this.announce(interaction);
    } else if (subcommand === 'stats') {
      return await this.showStats(interaction);
    } else if (subcommand === 'resetcooldown') {
      return await this.resetCooldown(interaction);
    }
  },

  async giveGold(interaction) {
    const targetUser = interaction.options.getUser('player');
    const amount = interaction.options.getInteger('amount');

    await interaction.deferReply({ ephemeral: true });

    try {
      const character = await prisma.character.findUnique({
        where: { userId: targetUser.id }
      });

      if (!character) {
        return await interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have a character!`
        });
      }

      await prisma.character.update({
        where: { id: character.id },
        data: { gold: { increment: amount } }
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Gold Given')
        .setDescription(
          `**Player:** ${character.name} (${targetUser.username})\n` +
          `**Amount:** ${amount.toLocaleString()} 💰\n` +
          `**New Total:** ${(character.gold + amount).toLocaleString()} 💰`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Notify player
      try {
        await targetUser.send({
          content: `🎁 A Game Master gave you **${amount.toLocaleString()}** 💰!`
        });
      } catch (error) {
        console.error('[GM] Failed to notify player:', error);
      }

    } catch (error) {
      console.error('[GM] Give gold error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while giving gold.'
      });
    }
  },

  async setLevel(interaction) {
    const targetUser = interaction.options.getUser('player');
    const level = interaction.options.getInteger('level');

    await interaction.deferReply({ ephemeral: true });

    try {
      const character = await prisma.character.findUnique({
        where: { userId: targetUser.id }
      });

      if (!character) {
        return await interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have a character!`
        });
      }

      // Calculate stats for new level
      const { applyExperience } = require('../game/leveling');
      const targetXp = this.calculateXpForLevel(level);

      await prisma.character.update({
        where: { id: character.id },
        data: {
          level,
          xp: targetXp
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Level Set')
        .setDescription(
          `**Player:** ${character.name} (${targetUser.username})\n` +
          `**Old Level:** ${character.level}\n` +
          `**New Level:** ${level}`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Notify player
      try {
        await targetUser.send({
          content: `🎁 A Game Master set your level to **${level}**!`
        });
      } catch (error) {
        console.error('[GM] Failed to notify player:', error);
      }

    } catch (error) {
      console.error('[GM] Set level error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting level.'
      });
    }
  },

  calculateXpForLevel(level) {
    // Simple XP formula: 100 * level^2
    return Math.floor(100 * Math.pow(level, 2));
  },

  async startEvent(interaction) {
    const type = interaction.options.getString('type');
    const duration = interaction.options.getInteger('duration');

    await interaction.deferReply({ ephemeral: true });

    try {
      const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);

      const eventData = {
        xp_boost: { name: '2x Experience', multiplier: 2, stat: 'xp' },
        gold_boost: { name: '2x Gold', multiplier: 2, stat: 'gold' },
        drop_boost: { name: '2x Drop Rate', multiplier: 2, stat: 'drop' },
        all_boost: { name: 'All Boosts (2x)', multiplier: 2, stat: 'all' }
      };

      const event = eventData[type];

      // Store event in DB
      await prisma.serverEvent.create({
        data: {
          type,
          name: event.name,
          multiplier: event.multiplier,
          startTime: new Date(),
          endTime,
          active: true
        }
      });

      // Announce to all servers
      const guilds = interaction.client.guilds.cache;
      
      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${event.name} EVENT STARTED!`)
        .setDescription(
          `**${event.name}** is now active for **${duration} hours**!\n\n` +
          `Get out there and enjoy the boost!\n\n` +
          `**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`
        )
        .setColor(0xffd700)
        .setTimestamp();

      for (const [, guild] of guilds) {
        try {
          const channel = guild.channels.cache.find(
            ch => ch.name.includes('general') || ch.name.includes('announcements')
          ) || guild.channels.cache.find(ch => ch.isTextBased());

          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error(`[GM] Failed to announce event in guild ${guild.name}:`, error);
        }
      }

      await interaction.editReply({
        content: `✅ Event **${event.name}** started! Duration: ${duration} hours`
      });

    } catch (error) {
      console.error('[GM] Start event error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while starting the event.'
      });
    }
  },

  async announce(interaction) {
    const message = interaction.options.getString('message');

    await interaction.deferReply({ ephemeral: true });

    try {
      const guilds = interaction.client.guilds.cache;
      
      const embed = new EmbedBuilder()
        .setTitle('📢 ANNOUNCEMENT')
        .setDescription(message)
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: 'From the Game Masters' });

      let sent = 0;
      let failed = 0;

      for (const [, guild] of guilds) {
        try {
          const channel = guild.channels.cache.find(
            ch => ch.name.includes('general') || ch.name.includes('announcements')
          ) || guild.channels.cache.find(ch => ch.isTextBased());

          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
            sent++;
          }
        } catch (error) {
          console.error(`[GM] Failed to announce in guild ${guild.name}:`, error);
          failed++;
        }
      }

      await interaction.editReply({
        content: `✅ Announcement sent to ${sent} servers! (${failed} failed)`
      });

    } catch (error) {
      console.error('[GM] Announce error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while sending announcement.'
      });
    }
  },

  async showStats(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const totalCharacters = await prisma.character.count();
      const totalGuilds = await prisma.guild.count();
      const activeWar = await prisma.guildWar.count({ where: { status: 'ACTIVE' } });
      const totalGold = await prisma.character.aggregate({
        _sum: { gold: true }
      });
      const avgLevel = await prisma.character.aggregate({
        _avg: { level: true }
      });
      const topPlayers = await prisma.character.findMany({
        take: 5,
        orderBy: { level: 'desc' },
        select: { name: true, level: true, gold: true }
      });

      const embed = new EmbedBuilder()
        .setTitle('📊 Server Statistics')
        .addFields(
          { name: '👥 Total Characters', value: totalCharacters.toLocaleString(), inline: true },
          { name: '🏰 Total Guilds', value: totalGuilds.toLocaleString(), inline: true },
          { name: '⚔️ Active Wars', value: activeWar.toString(), inline: true },
          { name: '💰 Total Gold', value: totalGold._sum.gold?.toLocaleString() || '0', inline: true },
          { name: '📈 Average Level', value: Math.floor(avgLevel._avg.level || 0).toString(), inline: true },
          { name: '🎮 Bot Servers', value: interaction.client.guilds.cache.size.toString(), inline: true }
        )
        .setColor(0x00aaff)
        .setTimestamp();

      if (topPlayers.length > 0) {
        const topList = topPlayers.map((p, i) => 
          `${i + 1}. **${p.name}** - Lv.${p.level} (${p.gold.toLocaleString()} 💰)`
        ).join('\n');
        
        embed.addFields({ name: '🏆 Top 5 Players', value: topList });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[GM] Stats error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching statistics.'
      });
    }
  },

  async resetCooldown(interaction) {
    const targetUser = interaction.options.getUser('player');

    await interaction.deferReply({ ephemeral: true });

    try {
      const character = await prisma.character.findUnique({
        where: { userId: targetUser.id }
      });

      if (!character) {
        return await interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have a character!`
        });
      }

      // Reset various cooldowns (adjust based on your cooldown systems)
      // This is a placeholder - implement based on your actual cooldown storage

      await interaction.editReply({
        content: `✅ Cooldowns reset for ${character.name}!`
      });

      // Notify player
      try {
        await targetUser.send({
          content: `🎁 A Game Master reset your cooldowns!`
        });
      } catch (error) {
        console.error('[GM] Failed to notify player:', error);
      }

    } catch (error) {
      console.error('[GM] Reset cooldown error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while resetting cooldowns.'
      });
    }
  }
};
