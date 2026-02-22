const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  JOB_CHANGE_LEVEL,
  getAdvancedClassChoices,
  getAdvancedClassData,
  canJobChange,
  applyJobChange,
} = require('../game/jobchange');
const {
  EMBED_COLORS,
  createDivider,
  localizeClassName,
} = require('../utils/ui');

const JOBCHANGE_BUTTON_PREFIX = 'jobchange:';

function createJobChangeSelectionEmbed(character, choices) {
  const descriptions = choices
    .map((choice) => {
      const bonusLines = [
        `   ⚔️ 공격력 +${choice.bonuses.attack}`,
        `   🛡️ 방어력 +${choice.bonuses.defense}`,
        `   ❤️ 최대 체력 +${choice.bonuses.maxHp}`,
        `   🔷 최대 마나 +${choice.bonuses.maxMana}`,
      ];

      const skillLines = choice.skills.map((skill) => `   ${skill}`);

      return [
        `${choice.emoji} **${choice.name}**`,
        `   ${choice.description}`,
        '',
        '   📊 보너스 능력치',
        ...bonusLines,
        '',
        '   ✨ 전용 스킬',
        ...skillLines,
      ].join('\n');
    })
    .join('\n\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🎊 전직 - ${localizeClassName(character.class)}`)
    .setDescription(
      [
        createDivider(),
        `📛 ${character.name} (Lv.${character.level})`,
        `⚔️ 기본 직업: ${localizeClassName(character.class)}`,
        createDivider(),
        '',
        '💎 전직 경로를 선택하세요!',
        '',
        descriptions,
        '',
        createDivider(),
        '⚠️ 전직은 되돌릴 수 없습니다. 신중하게 선택하세요!',
      ].join('\n'),
    )
    .setFooter({
      text: '전직 시 능력치 보너스가 즉시 적용됩니다',
    });
}

function createJobChangeActionRow(baseClass, choices) {
  const buttons = choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(`${JOBCHANGE_BUTTON_PREFIX}${baseClass}:${choice.key}`)
      .setLabel(choice.name)
      .setEmoji(choice.emoji)
      .setStyle(ButtonStyle.Primary),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

function createJobChangeResultEmbed(character, classData, bonuses) {
  const bonusLines = [
    `⚔️ 공격력: ${character.attack - bonuses.attack} → ${character.attack} (+${bonuses.attack})`,
    `🛡️ 방어력: ${character.defense - bonuses.defense} → ${character.defense} (+${bonuses.defense})`,
    `❤️ 최대 체력: ${character.maxHp - bonuses.maxHp} → ${character.maxHp} (+${bonuses.maxHp})`,
    `🔷 최대 마나: ${character.maxMana - bonuses.maxMana} → ${character.maxMana} (+${bonuses.maxMana})`,
  ];

  const skillLines = classData.skills.map((skill) => `${skill}`);

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🎊🎊🎊 전직 완료! 🎊🎊🎊`)
    .setDescription(
      [
        createDivider(),
        `${classData.emoji} ${character.name}님이 ${classData.name}(이)가 되었습니다!`,
        createDivider(),
        '',
        '📊 능력치 변화',
        ...bonusLines,
        '',
        `💊 체력과 마나가 완전히 회복되었습니다!`,
        `❤️ HP: ${character.hp}/${character.maxHp}`,
        `🔷 MP: ${character.mana}/${character.maxMana}`,
        '',
        '✨ 새로운 스킬',
        ...skillLines,
        '',
        createDivider(),
        '🎉 축하합니다! 더 강력해졌습니다!',
      ].join('\n'),
    )
    .setFooter({
      text: '홈랜드 - 전직 시스템',
    });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jobchange')
    .setDescription('레벨 10 달성 시 상위 직업으로 전직합니다'),

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

    const check = canJobChange(character);

    if (!check.allowed) {
      await interaction.reply({
        content: check.reason,
        ephemeral: true,
      });

      return;
    }

    const choices = getAdvancedClassChoices(character.class);

    if (choices.length === 0) {
      // 디버깅용 로그
      console.log(`[전직 오류] 캐릭터 ${character.name}의 class: '${character.class}' (type: ${typeof character.class})`);
      
      await interaction.reply({
        content: `사용 가능한 전직 경로가 없습니다.\n디버그: 현재 직업 = ${character.class || '없음'}`,
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createJobChangeSelectionEmbed(character, choices)],
      components: [createJobChangeActionRow(character.class, choices)],
      ephemeral: true,
    });
  },

  async handleJobChangeButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(JOBCHANGE_BUTTON_PREFIX)) {
      return false;
    }

    const [baseClass, advancedClassKey] = interaction.customId
      .slice(JOBCHANGE_BUTTON_PREFIX.length)
      .split(':');

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    const check = canJobChange(character);

    if (!check.allowed) {
      await interaction.reply({
        content: check.reason,
        ephemeral: true,
      });

      return true;
    }

    const update = applyJobChange(character, advancedClassKey);

    if (!update) {
      await interaction.reply({
        content: '유효하지 않은 전직 선택입니다.',
        ephemeral: true,
      });

      return true;
    }

    const classData = getAdvancedClassData(baseClass, advancedClassKey);

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

    await interaction.update({
      embeds: [createJobChangeResultEmbed(updatedCharacter, classData, classData.bonuses)],
      components: [],
    });

    return true;
  },

  JOBCHANGE_BUTTON_PREFIX,
};
