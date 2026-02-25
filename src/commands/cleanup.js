const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { cleanupAllOldSessions } = require('../game/session-cleanup');
const { EMBED_COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
		.setNameLocalizations({ "en-US": "cleanup" })
    .setDescription('[관리자] 오래된 전투 세션 정리')
		.setDescriptionLocalizations({ "en-US": "Manage [관리자] 오래된 전투 세션 정리" })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, { prisma }) {
    // 관리자 권한 체크
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const cleaned = await cleanupAllOldSessions(prisma);

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.victory)
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
