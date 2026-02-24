const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');
const {
  canProductionJobChange,
  getProductionAdvancedClassChoices,
  getProductionAdvancedClassData,
  applyProductionJobChange,
  PRODUCTION_JOB_CHANGE_LEVEL,
} = require('../game/production-advanced-classes');

const PRODUCTION_JOBCHANGE_BUTTON_PREFIX = 'prod_jobchange:';

function createProductionJobChangeSelectionEmbed(character, choices) {
  const choiceLines = choices.map((choice) => {
    return `${choice.emoji} **${choice.name}**\n${choice.description}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`✨ 생산 전직 - ${character.productionClass}`)
    .setDescription(
      [
        createDivider(),
        `🎓 현재 레벨: ${character.productionLevel}`,
        '',
        '💎 고급 직업을 선택하세요:',
        '',
        ...choiceLines,
        '',
        createDivider(),
        '💡 전직 후 되돌릴 수 없습니다!',
      ].join('\n'),
    )
    .setFooter({ text: '아래 버튼을 눌러 전직하세요' });
}

function createProductionJobChangeActionRow(baseClass, choices) {
  const buttons = choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(`${PRODUCTION_JOBCHANGE_BUTTON_PREFIX}${baseClass}:${choice.key}`)
      .setLabel(choice.name)
      .setEmoji(choice.emoji)
      .setStyle(ButtonStyle.Primary),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function createProductionJobChangeResultEmbed(character, classData) {
  return new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`✨ 생산 전직 완료!`)
    .setDescription(
      [
        createDivider(),
        `🎊 축하합니다!`,
        `${classData.emoji} **${classData.name}**이(가) 되었습니다!`,
        '',
        `📋 ${classData.description}`,
        '',
        createDivider(),
        '',
        '💡 새로운 능력:',
        ...Object.entries(classData.bonuses).map(
          ([key, value]) => `  • ${key}: +${Math.floor(value * 100)}%`,
        ),
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({ text: '생산 활동을 계속하세요!' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('production_jobchange')
    .setDescription('생산 레벨 5 달성 시 고급 생산 직업으로 전직합니다'),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    const check = canProductionJobChange(character);

    if (!check.allowed) {
      await interaction.reply({
        content: check.reason,
        ephemeral: true,
      });

      return;
    }

    const choices = getProductionAdvancedClassChoices(character.productionClass);

    if (choices.length === 0) {
      await interaction.reply({
        content: `사용 가능한 생산 전직 경로가 없습니다.\n디버그: 현재 생산 직업 = ${character.productionClass || '없음'}`,
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createProductionJobChangeSelectionEmbed(character, choices)],
      components: [createProductionJobChangeActionRow(character.productionClass, choices)],
      ephemeral: true,
    });
  },

  async handleProductionJobChangeButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(PRODUCTION_JOBCHANGE_BUTTON_PREFIX)) {
      return false;
    }

    // 버튼 interaction은 먼저 defer
    await interaction.deferUpdate();

    const [baseClass, advancedClassKey] = interaction.customId
      .slice(PRODUCTION_JOBCHANGE_BUTTON_PREFIX.length)
      .split(':');

    const character = await requireCharacter(prisma, interaction);
    if (!character) return true;

    const check = canProductionJobChange(character);

    if (!check.allowed) {
      await interaction.followUp({
        content: check.reason,
        ephemeral: true,
      });

      return true;
    }

    const update = applyProductionJobChange(character, advancedClassKey);

    if (!update) {
      await interaction.followUp({
        content: '유효하지 않은 생산 전직 선택입니다.',
        ephemeral: true,
      });

      return true;
    }

    const classData = getProductionAdvancedClassData(character.productionClass, advancedClassKey);

    await prisma.character.update({
      where: {
        id: character.id,
      },
      data: update,
    });

    const updatedCharacter = {
      ...character,
      ...update,
    };

    // 프로필 보기 버튼 추가
    const profileButton = new ButtonBuilder()
      .setCustomId('back_to_profile')
      .setLabel('프로필 보기')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(profileButton);

    await interaction.editReply({
      embeds: [createProductionJobChangeResultEmbed(updatedCharacter, classData)],
      components: [row],
    });

    return true;
  },

  PRODUCTION_JOBCHANGE_BUTTON_PREFIX,
};
