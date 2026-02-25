const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { RESOURCES, PRODUCTION_CLASSES } = require('../game/production-classes');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resources')
		.setNameLocalizations({ "en-US": "resources" })
    .setDescription('보유한 자원을 확인합니다')
		.setDescriptionLocalizations({ "en-US": "View 보유한 자원" }),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction, { include: { resources: { orderBy: { type: 'asc' } } } });
    if (!character) return;

    if (!character.productionClass) {
      await interaction.reply({
        content: '생산 직업이 없습니다. 먼저 `/production`으로 직업을 선택하세요.',
        ephemeral: true,
      });

      return;
    }

    const classData = PRODUCTION_CLASSES[character.productionClass];

    const resourceLines = character.resources.map((r) => {
      const resourceData = RESOURCES[r.type];
      return `${resourceData.emoji} **${r.name}**: ${r.quantity}개`;
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle(`${classData.emoji} ${character.name}의 자원`)
      .setDescription(
        [
          createDivider(),
          `💼 ${classData.name} Lv.${character.productionLevel}`,
          '',
          '📦 보유 자원',
          '',
          resourceLines.length > 0 ? resourceLines.join('\n') : '보유한 자원이 없습니다',
          '',
          createDivider(),
          '',
          '💡 `/gather`로 자원을 채집하세요',
        ].join('\n'),
      )
      .setFooter({
        text: '자원은 제작에 사용됩니다',
      });

    await interaction.reply({
      embeds: [embed],
    });
  },
};
