const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fieldboss')
    .setDescription('필드보스 입찰 시스템')
    .setDescriptionLocalizations({ ko: '필드보스 입찰 시스템' })
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('현재 필드보스 이벤트 확인')
        .setDescriptionLocalizations({ ko: '현재 필드보스 이벤트 확인' }))
    .addSubcommand(subcommand =>
      subcommand
        .setName('bid')
        .setDescription('필드보스에 입찰하기')
        .setDescriptionLocalizations({ ko: '필드보스에 입찰하기' })
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('입찰 금액 (골드)')
            .setDescriptionLocalizations({ ko: '입찰 금액 (골드)' })
            .setRequired(true)
            .setMinValue(1)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('challenge')
        .setDescription('필드보스에 도전 (낙찰자 전용)')
        .setDescriptionLocalizations({ ko: '필드보스에 도전 (낙찰자 전용)' })),

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
        content: '❌ 필드보스 시스템이 초기화되지 않았습니다!',
        ephemeral: true
      });
    }

    const info = await fieldBossSystem.getEventInfo();

    if (!info) {
      return await interaction.reply({
        content: '⏳ 현재 진행 중인 필드보스가 없습니다. 나중에 다시 확인하세요!',
        ephemeral: true
      });
    }

    const { event, bids } = info;
    const now = Date.now();
    const timeLeft = event.biddingEnd.getTime() - now;

    const embed = new EmbedBuilder()
      .setTitle(`🚨 ${event.bossName}`)
      .setDescription(
        `**레벨:** ${event.bossLevel}\n` +
        `**HP:** ${event.bossHp.toLocaleString()}\n` +
        `**공격력:** ${event.bossAttack.toLocaleString()}\n\n` +
        `**최소 입찰:** ${event.minBid.toLocaleString()} 💰\n` +
        `**입찰 마감:** <t:${Math.floor(event.biddingEnd.getTime() / 1000)}:R>\n` +
        `**남은 시간:** ${Math.floor(timeLeft / 1000 / 60)}분`
      )
      .setColor(0xff0000)
      .setTimestamp();

    if (bids.length > 0) {
      const bidList = bids.map((bid, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${bid.amount.toLocaleString()}** 💰 - ${bid.character.name}`;
      }).join('\n');

      embed.addFields({
        name: '💰 현재 입찰',
        value: bidList || '아직 입찰 없음'
      });
    } else {
      embed.addFields({
        name: '💰 현재 입찰',
        value: '아직 입찰이 없습니다. 첫 번째 입찰자가 되세요!'
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
      name: '🎁 보상',
      value: rewardText
    });

    embed.setFooter({ text: '/fieldboss bid <금액> 으로 입찰하세요!' });

    await interaction.reply({ embeds: [embed] });
  },

  async placeBid(interaction) {
    const amount = interaction.options.getInteger('amount');
    const fieldBossSystem = interaction.client.fieldBossSystem;

    if (!fieldBossSystem) {
      return await interaction.reply({
        content: '❌ 필드보스 시스템이 초기화되지 않았습니다!',
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
          content: '❌ 먼저 캐릭터를 생성해주세요! `/create` 사용'
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
        .setTitle('✅ 입찰 성공!')
        .setDescription(
          `**${result.amount.toLocaleString()}** 💰 입찰 완료!\n\n` +
          `행운을 빕니다! \`/fieldboss info\`로 현재 순위를 확인하세요.`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Announce new bid in channel
      const info = await fieldBossSystem.getEventInfo();
      const channelEmbed = new EmbedBuilder()
        .setTitle('💰 새 입찰!')
        .setDescription(
          `**${player.name}**님이 **${info.event.bossName}**에 **${result.amount.toLocaleString()}** 💰 입찰!`
        )
        .setColor(0xffaa00)
        .setTimestamp();

      if (interaction.channel && interaction.channel.isTextBased()) {
        await interaction.channel.send({ embeds: [channelEmbed] });
      }

    } catch (error) {
      console.error('[FieldBoss] Bid error:', error);
      await interaction.editReply({
        content: '❌ 입찰 중 오류가 발생했습니다. 다시 시도해주세요.'
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
          content: '❌ 먼저 캐릭터를 생성해주세요! `/create` 사용'
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
          content: '❌ 낙찰받은 필드보스가 없습니다!'
        });
      }

      // Start boss fight (use existing boss combat system)
      const combat = require('../game/boss-combat.js');
      await combat.startFieldBossFight(interaction, player, event);

    } catch (error) {
      console.error('[FieldBoss] Challenge error:', error);
      await interaction.editReply({
        content: '❌ 도전 시작 중 오류가 발생했습니다. 다시 시도해주세요.'
      });
    }
  }
};
