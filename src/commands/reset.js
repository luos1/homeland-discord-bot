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

    // 전투 세션 강제 종료 + 체력/마나 완전 회복
    await prisma.$transaction(async (tx) => {
      // 세션 삭제
      await tx.combatSession.delete({
        where: {
          id: character.combatSession.id,
        },
      });

      // 체력/마나 완전 회복
      await tx.character.update({
        where: {
          id: character.id,
        },
        data: {
          hp: character.maxHp,
          mana: character.maxMana || 0,
        },
      });
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.warning)
      .setTitle('⚠️ 전투 리셋 완료')
      .setDescription(
        [
          '✅ 진행 중이던 전투를 종료했습니다.',
          '💊 체력과 마나가 완전히 회복되었습니다.',
          '',
          `❤️ HP: ${character.maxHp}/${character.maxHp}`,
          `🔷 MP: ${character.maxMana || 0}/${character.maxMana || 0}`,
          '',
          '💡 일반적으로는 전투 중 "도망" 버튼을 사용하세요.',
        ].join('\n'),
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
