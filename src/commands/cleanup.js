const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { cleanupAllOldSessions } = require('../game/session-cleanup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('[관리자] 오래된 전투 세션 정리'),

  async execute(interaction, { prisma }) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const cleaned = await cleanupAllOldSessions(prisma);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🧹 세션 정리 완료')
        .setDescription(`총 **${cleaned}**개의 오래된 세션을 정리했습니다.`)
        .setFooter({ text: '30분 이상 비활성 세션이 삭제되었습니다.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Cleanup error:', error);
      await interaction.editReply({
        content: '❌ 정리 중 오류가 발생했습니다: ' + error.message,
      });
    }
  },
};
