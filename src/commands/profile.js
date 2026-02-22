const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { LEVEL_CAP, progressToNextLevel } = require('../game/leveling');
const { getZone } = require('../game/monsters');
const {
  EMBED_COLORS,
  createDivider,
  createHPBar,
  createXPBar,
  formatNumber,
  localizeClassName,
} = require('../utils/ui');

const PROFILE_BUTTON_IDS = {
  explore: 'profile_explore',
  inventory: 'profile_inventory',
  shop: 'profile_shop',
  stats: 'profile_stats',
};

async function getProfileCharacter(prisma, userId) {
  return prisma.character.findUnique({
    where: {
      userId,
    },
    include: {
      combatSession: true,
    },
  });
}

function createProfileEmbed(character) {
  const progress = progressToNextLevel(character);
  const xpBar = createXPBar(character.xp, progress.required, 10);
  const hpBar = createHPBar(character.hp, character.maxHp, 10);
  const currentMana = character.mana ?? 0;
  const maxMana = character.maxMana ?? Math.max(currentMana, 1);
  const manaBar = createHPBar(currentMana, maxMana, 10);

  const combatStatus = character.combatSession
    ? (() => {
        const zone = getZone(character.combatSession.zone);
        const zoneName = zone ? zone.name : character.combatSession.zone;

        return `${zoneName}에서 전투 중 (턴 ${character.combatSession.turn})`;
      })()
    : '마을에서 휴식 중';

  const xpLine =
    progress.required === null
      ? `${xpBar} 최대 (${LEVEL_CAP})`
      : `${xpBar} ${character.xp}/${progress.required} (${Math.floor(progress.ratio * 100)}%)`;

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`⚔️ ${character.name}님의 ${localizeClassName(character.class)}`)
    .setDescription(
      [
        createDivider(),
        `💎 레벨 ${character.level} | 💰 골드 ${formatNumber(character.gold)}G`,
        createDivider(),
        '',
        '📊 전투 능력치',
        `❤️ 체력: ${hpBar} ${character.hp}/${character.maxHp}`,
        `🔷 마나: ${manaBar} ${currentMana}/${maxMana}`,
        `⚔️ 공격력: ${character.attack}`,
        `🛡️ 방어력: ${character.defense}`,
        '💥 크리티컬: 5%',
        '',
        '📈 경험치',
        xpLine,
        progress.required === null
          ? '🏆 최대 레벨에 도달했습니다!'
          : `🎯 다음 레벨까지 ${progress.remaining} 남음`,
        '',
        `🎮 현재 상태: ${combatStatus}`,
      ].join('\n'),
    )
    .setFooter({
      text: '버튼으로 탐험/새로고침을 진행하세요',
    });
}

function createProfileActionRow(options = {}) {
  const disabled = options.disabled ?? false;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.explore)
      .setLabel('탐험')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.inventory)
      .setLabel('인벤토리')
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.shop)
      .setLabel('상점')
      .setEmoji('🏪')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.stats)
      .setLabel('새로고침')
      .setEmoji('📈')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('캐릭터 프로필과 전투 상태를 확인합니다'),

  async execute(interaction, { prisma }) {
    const character = await getProfileCharacter(prisma, interaction.user.id);

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });

      return;
    }

    const embed = createProfileEmbed(character);

    await interaction.reply({
      embeds: [embed],
      components: [createProfileActionRow()],
    });
  },
  PROFILE_BUTTON_IDS,
  getProfileCharacter,
  createProfileEmbed,
  createProfileActionRow,
};
