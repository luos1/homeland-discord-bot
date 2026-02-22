const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  PRODUCTION_SKILLS,
  getProductionSkillsByClass,
  hasProductionSkill,
  canLearnProductionSkill,
} = require('../game/production-skills');
const { PRODUCTION_CLASSES } = require('../game/production-classes');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const PSKILL_BUTTON_PREFIX = 'pskill:';

function createProductionSkillsEmbed(character, skills) {
  const classData = PRODUCTION_CLASSES[character.productionClass];

  const skillLines = skills.map((skill) => {
    const learned = hasProductionSkill(character, skill.key);
    const learnCheck = canLearnProductionSkill(skill, character);

    const statusIcon = learned ? '✅' : learnCheck.allowed ? '🔓' : '🔒';
    const statusText = learned
      ? '습득 완료'
      : learnCheck.allowed
        ? `구매 가능 (${skill.cost}G)`
        : learnCheck.reason;

    return [
      `${statusIcon} ${skill.emoji} **${skill.name}**`,
      `   ${skill.description}`,
      `   📊 요구 레벨: ${skill.requiredLevel} | ${statusText}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`${classData.emoji} ${classData.name} - 생산 스킬`)
    .setDescription(
      [
        createDivider(),
        `💼 ${classData.name} Lv.${character.productionLevel}`,
        `💰 골드: ${character.gold.toLocaleString()}G`,
        '',
        '📜 습득 가능한 스킬',
        '',
        ...skillLines,
        '',
        '💡 스킬을 배워 고급 레시피를 잠금 해제하세요!',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '아래 버튼으로 스킬을 구매하세요',
    });
}

function createProductionSkillsActionRow(character, skills) {
  const buttons = skills.slice(0, 4).map((skill) => {
    const learned = hasProductionSkill(character, skill.key);
    const learnCheck = canLearnProductionSkill(skill, character);

    return new ButtonBuilder()
      .setCustomId(`${PSKILL_BUTTON_PREFIX}learn:${skill.key}`)
      .setLabel(skill.name)
      .setEmoji(skill.emoji)
      .setStyle(learned ? ButtonStyle.Success : learnCheck.allowed ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(learned || !learnCheck.allowed);
  });

  return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('production_skills')
    .setDescription('생산 스킬을 확인하고 구매합니다'),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        skills: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    if (!character.productionClass) {
      await interaction.reply({
        content: '생산 직업이 없습니다. 먼저 `/production`으로 직업을 선택하세요.',
        ephemeral: true,
      });

      return;
    }

    const skills = getProductionSkillsByClass(character.productionClass);

    if (skills.length === 0) {
      await interaction.reply({
        content: '이 직업에는 추가 스킬이 없습니다.',
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createProductionSkillsEmbed(character, skills)],
      components: [createProductionSkillsActionRow(character, skills)],
    });
  },

  async handleProductionSkillButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(PSKILL_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(PSKILL_BUTTON_PREFIX.length);
    const [action, skillKey] = customId.split(':');

    if (action !== 'learn') {
      return false;
    }

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        skills: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    const skill = PRODUCTION_SKILLS[skillKey];

    if (!skill) {
      await interaction.reply({
        content: '❌ 유효하지 않은 스킬입니다.',
        ephemeral: true,
      });

      return true;
    }

    const learnCheck = canLearnProductionSkill(skill, character);

    if (!learnCheck.allowed) {
      await interaction.reply({
        content: `❌ ${learnCheck.reason}`,
        ephemeral: true,
      });

      return true;
    }

    // 스킬 구매
    await prisma.$transaction(async (tx) => {
      // 골드 차감 (atomic decrement)
      await tx.character.update({
        where: {
          id: character.id,
        },
        data: {
          gold: { decrement: skill.cost },
        },
      });

      // 스킬 추가
      await tx.skill.create({
        data: {
          characterId: character.id,
          skillKey: skill.key,
          skillLevel: 1,
          equipped: false,
        },
      });
    });

    // 업데이트된 캐릭터 가져오기
    const updatedCharacter = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      include: {
        skills: true,
      },
    });

    const allSkills = getProductionSkillsByClass(character.productionClass);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLORS.levelUp)
          .setTitle('✨ 스킬 습득!')
          .setDescription(
            [
              createDivider(),
              `${skill.emoji} **${skill.name}** 스킬을 배웠습니다!`,
              '',
              `📝 ${skill.description}`,
              '',
              `💰 골드 -${skill.cost}G (남은 골드: ${updatedCharacter.gold}G)`,
              '',
              '🎊 이제 새로운 레시피를 제작할 수 있습니다!',
              '',
              createDivider(),
            ].join('\n'),
          ),
      ],
      components: [createProductionSkillsActionRow(updatedCharacter, allSkills)],
    });

    return true;
  },

  PSKILL_BUTTON_PREFIX,
};
