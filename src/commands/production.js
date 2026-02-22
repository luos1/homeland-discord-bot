const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getGatheringClasses,
  getCraftingClasses,
  PRODUCTION_CLASSES,
} = require('../game/production-classes');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { maybeSendGuideTip } = require('../game/onboarding');

const PRODUCTION_BUTTON_PREFIX = 'production:';

function createProductionMainEmbed(character) {
  const hasProduction = !!character.productionClass;

  if (hasProduction) {
    const classData = PRODUCTION_CLASSES[character.productionClass];
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.profile)
      .setTitle(`${classData.emoji} ${classData.name}`)
      .setDescription(
        [
          createDivider(),
          `💼 생산 직업: **${classData.name}**`,
          `📊 레벨: ${character.productionLevel}`,
          `📈 경험치: ${character.productionXp}`,
          '',
          `📝 ${classData.description}`,
          '',
          createDivider(),
          '',
          '🔨 생산 메뉴',
          classData.category === 'gathering' ? '📦 /gather - 자원 채집' : '⚒️ /craft - 아이템 제작',
          '📊 /resources - 보유 자원 확인',
          '',
        ].join('\n'),
      )
      .setFooter({
        text: '생산 활동으로 경험치를 얻고 레벨을 올리세요',
      });
  }

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('💼 생산 직업 선택')
    .setDescription(
      [
        createDivider(),
        '생산 직업을 선택하세요',
        '',
        '📦 **채집 계열**',
        '자원을 수집하는 직업입니다',
        '',
        '⚒️ **제작 계열**',
        '아이템을 제작하는 직업입니다',
        '',
        '⚠️ 한 번 선택하면 변경할 수 없습니다',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '아래 버튼으로 카테고리를 선택하세요',
    });
}

function createCategorySelectActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PRODUCTION_BUTTON_PREFIX}category:gathering`)
      .setLabel('채집 계열')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${PRODUCTION_BUTTON_PREFIX}category:crafting`)
      .setLabel('제작 계열')
      .setEmoji('⚒️')
      .setStyle(ButtonStyle.Success),
  );
}

function createClassSelectEmbed(category) {
  const classes = category === 'gathering' ? getGatheringClasses() : getCraftingClasses();
  const title = category === 'gathering' ? '📦 채집 직업 선택' : '⚒️ 제작 직업 선택';

  const classLines = classes.map((c, index) => {
    return `${index + 1}. ${c.emoji} **${c.name}**\n   ${c.description}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(title)
    .setDescription(
      [
        createDivider(),
        ...classLines,
        '',
        '⚠️ 한 번 선택하면 변경할 수 없습니다',
        '',
        createDivider(),
      ].join('\n'),
    )
    .setFooter({
      text: '직업을 선택하세요',
    });
}

function createClassSelectActionRow(category) {
  const classes = category === 'gathering' ? getGatheringClasses() : getCraftingClasses();

  const buttons = classes.slice(0, 4).map((c) => {
    return new ButtonBuilder()
      .setCustomId(`${PRODUCTION_BUTTON_PREFIX}select:${c.key}`)
      .setLabel(c.name)
      .setEmoji(c.emoji)
      .setStyle(ButtonStyle.Primary);
  });

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`${PRODUCTION_BUTTON_PREFIX}back`)
      .setLabel('뒤로')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('production')
    .setDescription('생산 직업을 선택하거나 확인합니다'),

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

    const embed = createProductionMainEmbed(character);
    const components = character.productionClass ? [] : [createCategorySelectActionRow()];

    await interaction.reply({
      embeds: [embed],
      components,
    });

    await maybeSendGuideTip({
      prisma,
      user: interaction.user,
      interaction,
      category: 'production',
    });
  },

  async handleProductionButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(PRODUCTION_BUTTON_PREFIX)) {
      return false;
    }

    const customId = interaction.customId.slice(PRODUCTION_BUTTON_PREFIX.length);
    const [action, param] = customId.split(':');

    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터를 찾을 수 없습니다.',
        ephemeral: true,
      });

      return true;
    }

    // 카테고리 선택
    if (action === 'category') {
      const category = param;

      await interaction.update({
        embeds: [createClassSelectEmbed(category)],
        components: [createClassSelectActionRow(category)],
      });

      return true;
    }

    // 뒤로가기
    if (action === 'back') {
      await interaction.update({
        embeds: [createProductionMainEmbed(character)],
        components: [createCategorySelectActionRow()],
      });

      return true;
    }

    // 직업 선택
    if (action === 'select') {
      const classKey = param;

      if (character.productionClass) {
        await interaction.reply({
          content: '⚠️ 이미 생산 직업을 선택했습니다.',
          ephemeral: true,
        });

        return true;
      }

      const classData = PRODUCTION_CLASSES[classKey];

      if (!classData) {
        await interaction.reply({
          content: '❌ 유효하지 않은 직업입니다.',
          ephemeral: true,
        });

        return true;
      }

      // 생산 직업 설정
      await prisma.character.update({
        where: {
          id: character.id,
        },
        data: {
          productionClass: classKey,
          productionLevel: 1,
          productionXp: 0,
        },
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLORS.levelUp)
            .setTitle('✨ 생산 직업 선택 완료!')
            .setDescription(
              [
                createDivider(),
                `${classData.emoji} **${classData.name}** 직업을 선택했습니다!`,
                '',
                `📝 ${classData.description}`,
                '',
                '🔨 이제 생산 활동을 시작할 수 있습니다',
                classData.category === 'gathering'
                  ? '📦 `/gather` 명령어로 자원 채집'
                  : '⚒️ `/craft` 명령어로 아이템 제작',
                '',
                createDivider(),
              ].join('\n'),
            ),
        ],
        components: [],
      });

      return true;
    }

    return false;
  },

  PRODUCTION_BUTTON_PREFIX,
};
