const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTodayQuests, claimQuestReward } = require('../game/daily-quest-system');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('일일 퀘스트 확인')
    .setDescriptionLocalizations({ ko: '일일 퀘스트 확인' }),

  async execute(interaction, { prisma }) {
    const result = await getTodayQuests(interaction.user.id, prisma);

    if (!result.success) {
      return interaction.reply({ content: '❌ 퀘스트를 불러올 수 없습니다.', ephemeral: true });
    }

    const { quests } = result;

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('📋 오늘의 일일 퀘스트')
      .setDescription([
        '매일 자정에 새로운 퀘스트가 갱신됩니다.',
        '',
        '**진행 중인 퀘스트:**'
      ].join('\n'));

    const buttons = [];

    quests.forEach((quest, index) => {
      const progress = `${quest.progress}/${quest.target}`;
      const status = quest.claimed ? '✅ 완료' : quest.completed ? '🎁 수령 가능' : `⏳ ${progress}`;

      embed.addFields({
        name: `${index + 1}. ${quest.name} ${status}`,
        value: [
          `📝 ${quest.description}`,
          `🎁 보상: 💰 ${quest.rewards.gold}G, ⭐ ${quest.rewards.xp} XP`,
          `📊 진행도: ${progress}`
        ].join('\n'),
        inline: false
      });

      if (quest.completed && !quest.claimed) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`daily_claim_${quest.id}`)
            .setLabel(`${quest.name} 보상 받기`)
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
        );
      }
    });

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    await interaction.reply({ embeds: [embed], components: rows });
  },

  async handleDailyButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith('daily_claim_')) return false;

    const questId = interaction.customId.replace('daily_claim_', '');

    const result = await claimQuestReward(interaction.user.id, questId, prisma);

    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🎉 보상 획득!')
      .setDescription([
        '일일 퀘스트 보상을 받았습니다!',
        '',
        `💰 골드: +${result.rewards.gold}G`,
        `⭐ 경험치: +${result.rewards.xp} XP`
      ].join('\n'));

    await interaction.reply({ embeds: [embed] });
    return true;
  }
};
