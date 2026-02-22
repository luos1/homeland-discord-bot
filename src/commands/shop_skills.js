const { SlashCommandBuilder } = require('discord.js');

const {
  createSkillShopEmbed,
  createSkillShopActionRow,
} = require('../game/shop-skills');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop_skills')
    .setDescription('[호환] 전직 스킬 상점을 엽니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });
      return;
    }

    if (!character.advancedClass) {
      await interaction.reply({
        content: '전직 후에 스킬 상점을 이용할 수 있습니다. `/jobchange`를 먼저 진행해주세요.',
        ephemeral: true,
      });
      return;
    }

    const learnedSkills = await prisma.skill.findMany({
      where: {
        characterId: character.id,
      },
    });

    await interaction.reply({
      embeds: [createSkillShopEmbed(character, learnedSkills)],
      components: [createSkillShopActionRow(character, learnedSkills)],
    });
  },
};
