const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_character')
    .setDescription('⚠️ 캐릭터를 완전히 삭제합니다 (되돌릴 수 없습니다!)'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '삭제할 캐릭터가 없습니다.',
        ephemeral: true,
      });
      return;
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ 캐릭터 삭제 확인')
      .setDescription(
        [
          createDivider(),
          `캐릭터: **${character.name}**`,
          `직업: ${character.advancedClass || character.class}`,
          `레벨: ${character.level}`,
          `골드: ${character.gold}G`,
          '',
          '❌ **이 캐릭터를 완전히 삭제하시겠습니까?**',
          '',
          '⚠️ 이 작업은 되돌릴 수 없습니다!',
          '⚠️ 모든 장비, 아이템, 스킬이 사라집니다!',
          '',
          createDivider(),
        ].join('\n'),
      )
      .setFooter({ text: '신중하게 선택하세요' });

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_delete_character')
      .setLabel('삭제 확인')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_delete_character')
      .setLabel('취소')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true,
    });
  },

  async handleButton(interaction, { prisma }) {
    if (interaction.customId === 'confirm_delete_character') {
      const character = await prisma.character.findUnique({
        where: {
          userId: interaction.user.id,
        },
      });

      if (!character) {
        await interaction.update({
          content: '삭제할 캐릭터가 없습니다.',
          embeds: [],
          components: [],
        });
        return true;
      }

      // 캐릭터 삭제 (Cascade로 모든 관련 데이터 자동 삭제)
      await prisma.character.delete({
        where: {
          id: character.id,
        },
      });

      const resultEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 캐릭터 삭제 완료')
        .setDescription(
          [
            createDivider(),
            `**${character.name}** 캐릭터가 삭제되었습니다.`,
            '',
            '💡 새 캐릭터를 만들려면:',
            '`/create class:전사 (탱커)`',
            '',
            createDivider(),
          ].join('\n'),
        );

      await interaction.update({
        embeds: [resultEmbed],
        components: [],
      });

      return true;
    }

    if (interaction.customId === 'cancel_delete_character') {
      await interaction.update({
        content: '❌ 캐릭터 삭제가 취소되었습니다.',
        embeds: [],
        components: [],
      });
      return true;
    }

    return false;
  },
};
