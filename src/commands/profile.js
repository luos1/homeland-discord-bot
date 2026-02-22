const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { LEVEL_CAP, progressToNextLevel } = require('../game/leveling');
const { getZone } = require('../game/monsters');
const { canJobChange, JOB_CHANGE_LEVEL } = require('../game/jobchange');
const { canProductionJobChange } = require('../game/production-advanced-classes');
const { calculateEquipmentStats } = require('../game/equipment');
const { getStreakDisplay } = require('../game/streak');
const { cleanupOldSessions } = require('../game/session-cleanup');
const { resolvePremiumBenefits } = require('../game/premium');
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
  production: 'profile_production',
  production_jobchange: 'profile_production_jobchange',
  stats: 'profile_stats',
  endCombat: 'profile_end_combat',
  boss: 'profile_boss',
  jobchange: 'profile_jobchange',
};

async function getProfileCharacter(prisma, userId) {
  // 오래된 세션 자동 정리 (30분 이상)
  const cleaned = await cleanupOldSessions(prisma, userId);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} old session(s) for user ${userId}`);
  }

  return prisma.character.findUnique({
    where: {
      userId,
    },
    include: {
      combatSession: true,
      equipment: true,
      skills: true,
      premiumSubscription: true,
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
  const premiumBenefits = resolvePremiumBenefits(character.premiumSubscription);
  const premiumStatusLine = premiumBenefits.active
    ? `👑 Premium 활성 (XP +${Math.round((premiumBenefits.xpMultiplier - 1) * 100)}%, GOLD +${Math.round((premiumBenefits.goldMultiplier - 1) * 100)}%)`
    : '👑 Premium 비활성';

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

  const jobCheck = canJobChange(character);
  const jobLine = character.advancedClass
    ? `💎 전직: ${character.advancedClass}`
    : jobCheck.allowed
      ? `✨ 전직 가능! Lv.${JOB_CHANGE_LEVEL} 달성`
      : `⭐ 전직: Lv.${JOB_CHANGE_LEVEL}부터 가능`;

  // 연승 표시
  const streakDisplay = getStreakDisplay(character.winStreak || 0);
  const streakLine = streakDisplay
    ? `${streakDisplay} (최고: ${character.maxWinStreak || 0}연승)`
    : null;

  // 장비 보너스 계산
  const equipmentStats = character.equipment
    ? calculateEquipmentStats(character.equipment)
    : { attack: 0, defense: 0, hp: 0, mana: 0, effects: [] };

  const totalAttack = character.attack + equipmentStats.attack;
  const totalDefense = character.defense + equipmentStats.defense;

  const attackLine =
    equipmentStats.attack > 0
      ? `⚔️ 공격력: ${totalAttack} (기본 ${character.attack} + 장비 ${equipmentStats.attack})`
      : `⚔️ 공격력: ${character.attack}`;

  const defenseLine =
    equipmentStats.defense > 0
      ? `🛡️ 방어력: ${totalDefense} (기본 ${character.defense} + 장비 ${equipmentStats.defense})`
      : `🛡️ 방어력: ${character.defense}`;

  // 생산 클래스 정보
  let productionLine = null;
  if (character.productionClass) {
    const { PRODUCTION_CLASSES } = require('../game/production-classes');
    const { getRequiredProductionXP } = require('../game/production-leveling');
    const classData = PRODUCTION_CLASSES[character.productionClass];
    const nextLevelXp = getRequiredProductionXP(character.productionLevel) || 1;
    const productionProgress = Math.floor((character.productionXp / nextLevelXp) * 100);
    
    const className = character.advancedProductionClass || classData.name;
    productionLine = `${classData.emoji} ${className} Lv.${character.productionLevel} (${character.productionXp}/${nextLevelXp} | ${productionProgress}%)`;
  }

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`⚔️ ${character.name}님의 ${localizeClassName(character.class)}`)
    .setDescription(
      [
        createDivider(),
        `💎 레벨 ${character.level} | 💰 골드 ${formatNumber(character.gold)}G | 💠 젬 ${formatNumber(character.gems || 0)}`,
        premiumStatusLine,
        jobLine,
        productionLine,
        streakLine,
        createDivider(),
        '',
        '📊 전투 능력치',
        `❤️ 체력: ${hpBar} ${character.hp}/${character.maxHp}`,
        `🔷 마나: ${manaBar} ${currentMana}/${maxMana}`,
        attackLine,
        defenseLine,
        '💥 크리티컬: 5%',
        '',
        '📈 경험치',
        xpLine,
        progress.required === null
          ? '🏆 최대 레벨에 도달했습니다!'
          : `🎯 다음 레벨까지 ${progress.remaining} 남음`,
        '',
        `🎮 현재 상태: ${combatStatus}`,
      ].filter(v => v != null).join('\n'),
    )
    .setFooter({
      text: jobCheck.allowed ? '전직 가능! /jobchange 명령어를 사용하세요' : '버튼으로 탐험/새로고침을 진행하세요',
    });
}

function createProfileActionRow(options = {}) {
  const disabled = options.disabled ?? false;
  const character = options.character ?? null;
  const hasCombat = character?.combatSession ?? false;

  const row1Buttons = [
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.explore)
      .setLabel('탐험')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.boss)
      .setLabel('보스')
      .setEmoji('🐉')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.production)
      .setLabel('생산')
      .setEmoji('🔨')
      .setStyle(ButtonStyle.Secondary)
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
  ];

  const row2Buttons = [
    new ButtonBuilder()
      .setCustomId(PROFILE_BUTTON_IDS.stats)
      .setLabel('새로고침')
      .setEmoji('📈')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  ];

  // 전직 가능하면 전직 버튼 추가
  if (character && !character.advancedClass) {
    const jobCheck = canJobChange(character);
    if (jobCheck.allowed) {
      row2Buttons.push(
        new ButtonBuilder()
          .setCustomId(PROFILE_BUTTON_IDS.jobchange)
          .setLabel('전직하기')
          .setEmoji('✨')
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
      );
    }
  }

  // 생산 전직 가능하면 생산 전직 버튼 추가
  if (character && !character.advancedProductionClass) {
    const prodJobCheck = canProductionJobChange(character);
    if (prodJobCheck.allowed) {
      row2Buttons.push(
        new ButtonBuilder()
          .setCustomId(PROFILE_BUTTON_IDS.production_jobchange)
          .setLabel('생산 전직')
          .setEmoji('🔧')
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
      );
    }
  }

  // 전투 중이면 전투 종료 버튼 추가
  if (hasCombat) {
    row2Buttons.push(
      new ButtonBuilder()
        .setCustomId(PROFILE_BUTTON_IDS.endCombat)
        .setLabel('전투 종료')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
    );
  }

  return [
    new ActionRowBuilder().addComponents(row1Buttons),
    new ActionRowBuilder().addComponents(row2Buttons),
  ];
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
      components: createProfileActionRow({ character }),
    });
  },
  PROFILE_BUTTON_IDS,
  getProfileCharacter,
  createProfileEmbed,
  createProfileActionRow,
};
