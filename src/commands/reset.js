const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { forceEndUserSession } = require('../game/session-cleanup');
const { EMBED_COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('진행 중인 전투를 강제로 종료합니다 (응급 상황용)'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        combatSession: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다.',
        ephemeral: true,
      });
      return;
    }

    if (!character.combatSession) {
      await interaction.reply({
        content: '진행 중인 전투가 없습니다.',
        ephemeral: true,
      });
      return;
    }

    // 전투 세션 강제 종료
    const ended = await forceEndUserSession(prisma, interaction.user.id);

    if (ended) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.warning)
        .setTitle('⚠️ 전투 종료')
        .setDescription(
          [
            '진행 중이던 전투를 강제로 종료했습니다.',
            '',
            '💡 이 명령어는 응급 상황에만 사용하세요.',
            '일반적으로는 전투 중 "도망" 버튼을 사용하세요.',
          ].join('\n'),
        );

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '전투 종료에 실패했습니다.',
        ephemeral: true,
      });
    }
  },
};
