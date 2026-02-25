const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { forceEndUserSession } = require('../game/session-cleanup');
const { EMBED_COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
		.setNameLocalizations({ "en-US": "reset" })
    .setDescription('진행 중인 전투를 강제로 종료합니다 (응급 상황용)')
		.setDescriptionLocalizations({ "en-US": "진행 중인 전투를 강제로 종료합니다 (응급 상황용)" }),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        combatSession: true,
        gatherSessions: true,
        craftingSessions: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다.',
        ephemeral: true,
      });
      return;
    }

    const hasCombat = !!character.combatSession;
    const hasGather = character.gatherSessions.length > 0;
    const hasCraft = character.craftingSessions.length > 0;

    if (!hasCombat && !hasGather && !hasCraft) {
      await interaction.reply({
        content: '진행 중인 전투나 생산 세션이 없습니다.',
        ephemeral: true,
      });
      return;
    }

    try {
      // 모든 활성 세션 강제 종료 + 체력/마나 완전 회복
      await prisma.$transaction(async (tx) => {
        // 전투 세션 삭제
        if (hasCombat) {
          await tx.combatSession.delete({
            where: {
              id: character.combatSession.id,
            },
          });
        }

        // 채집 세션 삭제
        if (hasGather) {
          await tx.gatherSession.deleteMany({
            where: {
              characterId: character.id,
            },
          });
        }

        // 제작 세션 삭제
        if (hasCraft) {
          await tx.craftingSession.deleteMany({
            where: {
              characterId: character.id,
            },
          });
        }

        // 체력/마나 완전 회복
        await tx.character.update({
          where: {
            id: character.id,
          },
          data: {
            hp: character.maxHp,
            mana: character.maxMana ?? 0,
          },
        });
      });
    } catch (error) {
      console.error('Reset error:', error);
      await interaction.reply({
        content: '❌ 리셋 중 오류가 발생했습니다. 다시 시도해주세요.',
        ephemeral: true,
      });
      return;
    }

    const resetDetails = [];
    if (hasCombat) resetDetails.push('⚔️ 전투 세션 종료');
    if (hasGather) resetDetails.push('📦 채집 세션 종료');
    if (hasCraft) resetDetails.push('⚒️ 제작 세션 종료');

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.warning)
      .setTitle('⚠️ 리셋 완료')
      .setDescription(
        [
          ...resetDetails,
          '💊 체력과 마나가 완전히 회복되었습니다.',
          '',
          `❤️ HP: ${character.maxHp}/${character.maxHp}`,
          `🔷 MP: ${character.maxMana ?? 0}/${character.maxMana ?? 0}`,
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
