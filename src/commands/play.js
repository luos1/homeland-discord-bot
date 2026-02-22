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
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle('🎮 플레이 시작 준비')
    .setDescription(
      [
        createDivider(),
        '아직 캐릭터가 없습니다.',
        '아래 명령어로 캐릭터를 생성하세요:',
        '',
        '**선택 가능한 직업**',
        '🛡️ 전사 (탱커) - `/create class:전사 (탱커)`',
        '🏹 궁수 (균형형) - `/create class:궁수 (균형형)`',
        '🔮 마법사 (고화력) - `/create class:마법사 (고화력)`',
        '',
        '※ 이름을 지정하려면:',
        '`/create class:전사 (탱커) name:내이름`',
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
        // components 임시 제거 - 버튼 에러 회피
        // components: [createPlayCreateActionRow()],
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      embeds: [createProfileEmbed(character)],
      components: createProfileActionRow({ character }),
    });
  },
  PLAY_CREATE_BUTTON_PREFIX,
  getPlayCreateClassChoice,
};
