const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fieldboss')
    .setDescription('Field boss bidding system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('View current field boss event'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('bid')
        .setDescription('Place a bid on the current field boss')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Bid amount in gold')
            .setRequired(true)
            .setMinValue(1)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('challenge')
        .setDescription('Challenge the field boss (winner only)')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      return await this.showInfo(interaction);
    } else if (subcommand === 'bid') {
      return await this.placeBid(interaction);
    } else if (subcommand === 'challenge') {
      return await this.startChallenge(interaction);
    }
  },

  async showInfo(interaction) {
    const fieldBossSystem = interaction.client.fieldBossSystem;

    if (!fieldBossSystem) {
      return await interaction.reply({
        content: '❌ Field boss system not initialized!',
        ephemeral: true
      });
    }

    const info = await fieldBossSystem.getEventInfo();

    if (!info) {
      return await interaction.reply({
        content: '⏳ No active field boss event. Check back later!',
        ephemeral: true
      });
    }

    const { event, bids } = info;
    const now = Date.now();
    const timeLeft = event.biddingEnd.getTime() - now;

    const embed = new EmbedBuilder()
      .setTitle(`🚨 ${event.bossName}`)
      .setDescription(
        `**Level:** ${event.bossLevel}\n` +
        `**HP:** ${event.bossHp.toLocaleString()}\n` +
        `**Attack:** ${event.bossAttack.toLocaleString()}\n\n` +
        `**Minimum Bid:** ${event.minBid.toLocaleString()} 💰\n` +
        `**Bidding Ends:** <t:${Math.floor(event.biddingEnd.getTime() / 1000)}:R>\n` +
        `**Time Left:** ${Math.floor(timeLeft / 1000 / 60)} minutes`
      )
      .setColor(0xff0000)
      .setTimestamp();

    if (bids.length > 0) {
      const bidList = bids.map((bid, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${bid.amount.toLocaleString()}** 💰 - ${bid.player.name}`;
      }).join('\n');

      embed.addFields({
        name: '💰 Current Bids',
        value: bidList || 'No bids yet'
      });
    } else {
      embed.addFields({
        name: '💰 Current Bids',
        value: 'No bids yet. Be the first!'
      });
    }

    // Show rewards
    const rewards = JSON.parse(event.rewards);
    const rewardText = rewards.map(r => 
      r.type === 'EQUIPMENT' ? `• **${r.name}** (${r.rarity})` :
      r.type === 'GOLD' ? `• **${r.amount.toLocaleString()}** 💰` :
      `• **${r.amount.toLocaleString()}** XP`
    ).join('\n');

    embed.addFields({
      name: '🎁 Rewards',
      value: rewardText
    });

    embed.setFooter({ text: 'Use /fieldboss bid <amount> to place your bid!' });

    await interaction.reply({ embeds: [embed] });
  },

  async placeBid(interaction) {
    const amount = interaction.options.getInteger('amount');
    const fieldBossSystem = interaction.client.fieldBossSystem;

    if (!fieldBossSystem) {
      return await interaction.reply({
        content: '❌ Field boss system not initialized!',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get player
      const player = await prisma.character.findUnique({
        where: { userId: interaction.user.id }
      });

      if (!player) {
        return await interaction.editReply({
          content: '❌ You need to create a character first! Use `/create`'
        });
      }

      // Place bid
      const result = await fieldBossSystem.placeBid(player.id, amount);

      if (!result.success) {
        return await interaction.editReply({
          content: `❌ ${result.message}`
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Bid Placed Successfully!')
        .setDescription(
          `You bid **${result.amount.toLocaleString()}** 💰\n\n` +
          `Good luck! Check \`/fieldboss info\` to see current standings.`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Announce new bid in channel
      const info = await fieldBossSystem.getEventInfo();
      const channelEmbed = new EmbedBuilder()
        .setTitle('💰 New Bid Placed!')
        .setDescription(
          `**${player.name}** bid **${result.amount.toLocaleString()}** 💰 on **${info.event.bossName}**!`
        )
        .setColor(0xffaa00)
        .setTimestamp();

      if (interaction.channel && interaction.channel.isTextBased()) {
        await interaction.channel.send({ embeds: [channelEmbed] });
      }

    } catch (error) {
      console.error('[FieldBoss] Bid error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while placing your bid. Please try again.'
      });
    }
  },

  async startChallenge(interaction) {
    await interaction.deferReply();

    try {
      // Get player
      const player = await prisma.character.findUnique({
        where: { userId: interaction.user.id },
        include: {
          equipment: true,
          skills: true
        }
      });

      if (!player) {
        return await interaction.editReply({
          content: '❌ You need to create a character first! Use `/create`'
        });
      }

      // Find their won event
      const event = await prisma.fieldBossEvent.findFirst({
        where: {
          winnerId: player.id,
          status: 'FIGHTING'
        }
      });

      if (!event) {
        return await interaction.editReply({
          content: '❌ You haven\'t won any field boss bids!'
        });
      }

      // Start boss fight (use existing boss combat system)
      const combat = require('../game/boss-combat.js');
      await combat.startFieldBossFight(interaction, player, event);

    } catch (error) {
      console.error('[FieldBoss] Challenge error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while starting the challenge. Please try again.'
      });
    }
  }
};
