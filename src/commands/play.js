const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { CLASS_PRESETS } = require('./create');
const {
  createProfileActionRow,
  createProfileEmbed,
  getProfileCharacter,
} = require('./profile');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const PLAY_CREATE_BUTTON_PREFIX = 'play_create:';
const PLAY_CREATE_CLASS_KEYS = ['warrior', 'ranger', 'sorcerer'];
const PLAY_CREATE_BUTTON_STYLES = {
  warrior: ButtonStyle.Primary,
  ranger: ButtonStyle.Secondary,
  sorcerer: ButtonStyle.Success,
};
const PLAY_CREATE_BUTTON_EMOJIS = {
  warrior: '🛡️',
  ranger: '🏹',
  sorcerer: '🔮',
};

function createPlayCreateEmbed() {
  const classLines = PLAY_CREATE_CLASS_KEYS.map((classKey) => {
    const classPreset = CLASS_PRESETS[classKey];
    return `${PLAY_CREATE_BUTTON_EMOJIS[classKey]} ${classPreset.label}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('🎮 플레이 시작 준비')
    .setDescription(
      [
        createDivider(),
        '아직 캐릭터가 없습니다.',
        '아래 직업 버튼을 누르면 바로 캐릭터를 생성합니다.',
        '',
        '선택 가능한 직업',
        ...classLines,
        '',
        '※ 버튼 생성 시 이름은 디스코드 닉네임으로 설정됩니다.',
        '※ 이름을 직접 지정하려면 `/create class:<직업> name:<이름>`을 사용하세요.',
        createDivider(),
      ].join('\n'),
    );
}

function createPlayCreateActionRow() {
  const classButtons = PLAY_CREATE_CLASS_KEYS.map((classKey) => {
    const button = new ButtonBuilder()
      .setCustomId(`${PLAY_CREATE_BUTTON_PREFIX}${classKey}`)
      .setLabel(CLASS_PRESETS[classKey].label)
      .setStyle(PLAY_CREATE_BUTTON_STYLES[classKey] ?? ButtonStyle.Secondary);
    
    // Emoji는 선택적으로 추가
    const emoji = PLAY_CREATE_BUTTON_EMOJIS[classKey];
    if (emoji) {
      button.setEmoji(emoji);
    }
    
    return button;
  });

  return new ActionRowBuilder().addComponents(...classButtons);
}

function getPlayCreateClassChoice(customId) {
  if (!customId.startsWith(PLAY_CREATE_BUTTON_PREFIX)) {
    return null;
  }

  const classChoice = customId.slice(PLAY_CREATE_BUTTON_PREFIX.length);

  if (!Object.prototype.hasOwnProperty.call(CLASS_PRESETS, classChoice)) {
    return null;
  }

  return classChoice;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('캐릭터가 없으면 생성하고, 있으면 플레이 화면을 엽니다'),

  async execute(interaction, { prisma }) {
    const character = await getProfileCharacter(prisma, interaction.user.id);

    if (!character) {
      await interaction.reply({
        embeds: [createPlayCreateEmbed()],
        components: [createPlayCreateActionRow()],
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createProfileEmbed(character)],
      components: [createProfileActionRow()],
    });
  },
  PLAY_CREATE_BUTTON_PREFIX,
  getPlayCreateClassChoice,
};
