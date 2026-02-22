const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { PROFILE_BUTTON_IDS } = require('./profile');
const {
  EMBED_COLORS,
  createDivider,
  localizeClassName,
} = require('../utils/ui');

const CLASS_PRESETS = {
  warrior: {
    label: '전사',
    hp: 120,
    mana: 36,
    attack: 12,
    defense: 8,
  },
  ranger: {
    label: '궁수',
    hp: 100,
    mana: 42,
    attack: 14,
    defense: 6,
  },
  sorcerer: {
    label: '마법사',
    hp: 90,
    mana: 52,
    attack: 16,
    defense: 4,
  },
};

function createCharacterActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.explore)
      .setLabel('탐험 시작')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.stats)
      .setLabel('프로필 보기')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('홈랜드 캐릭터를 생성합니다')
    .addStringOption((option) =>
      option
        .setName('class')
        .setDescription('직업을 선택하세요')
        .setRequired(true)
        .addChoices(
          { name: '전사 (탱커)', value: 'warrior' },
          { name: '궁수 (균형형)', value: 'ranger' },
          { name: '마법사 (고화력)', value: 'sorcerer' },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('캐릭터 이름 (선택)')
        .setRequired(false)
        .setMinLength(2)
        .setMaxLength(24),
    ),

  async execute(interaction, { prisma }) {
    const classChoice = interaction.options.getString('class', true);
    const customName = interaction.options.getString('name');

    const classPreset = CLASS_PRESETS[classChoice];

    if (!classPreset) {
      await interaction.reply({
        content: '유효하지 않은 직업입니다. 다시 선택해주세요.',
        ephemeral: true,
      });

      return;
    }

    const existingCharacter = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    if (existingCharacter) {
      await interaction.reply({
        content: '이미 캐릭터가 있습니다. `/profile`로 확인해주세요.',
        ephemeral: true,
      });

      return;
    }

    const rawName = customName ?? interaction.user.username;
    // 유해 문자 제거: Discord 마크다운 / 멘션 / 특수 기호
    const characterName = rawName.replace(/[*_`~@#<>|\\]/g, '').trim() || interaction.user.username;

    let character;
    try {
      await prisma.user.upsert({
        where: {
          discordId: interaction.user.id,
        },
        update: {
          username: interaction.user.username,
        },
        create: {
          discordId: interaction.user.id,
          username: interaction.user.username,
        },
      });

      character = await prisma.character.create({
        data: {
          userId: interaction.user.id,
          name: characterName,
          class: classPreset.label,
          hp: classPreset.hp,
          maxHp: classPreset.hp,
          mana: classPreset.mana,
          maxMana: classPreset.mana,
          attack: classPreset.attack,
          defense: classPreset.defense,
        },
      });
    } catch (error) {
      console.error('Character creation error:', error);
      await interaction.reply({
        content: '❌ 캐릭터 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.create)
      .setTitle(`⚔️ ${localizeClassName(character.class)} 캐릭터 생성 완료!`)
      .setDescription(
        [
          createDivider(),
          `📛 이름: ${character.name}`,
          `⚔️ 직업: ${localizeClassName(character.class)}`,
          createDivider(),
          '',
          '📊 초기 능력치',
          `❤️ 체력: ${character.hp}/${character.maxHp}`,
          `🔷 마나: ${character.mana}/${character.maxMana}`,
          `⚔️ 공격력: ${character.attack}`,
          `🛡️ 방어력: ${character.defense}`,
          `💰 골드: ${character.gold}G`,
          '',
          '🎯 전투를 시작해보세요!',
        ].join('\n'),
      )
      .setFooter({
        text: '홈랜드 모험의 시작',
      });

    await interaction.reply({
      embeds: [embed],
      components: [createCharacterActionRow()],
    });
  },
  CLASS_PRESETS,
  createCharacterActionRow,
};
