/**
 * Tower Button Handlers
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const {
  TOWER_CONFIG,
  getFloorConfig,
  buyTicket,
  startTowerRun,
  challengeFloor,
  clearFloor,
} = require('./tower-system');
const { initializeCombat, handleCombatButton } = require('./combat');

const prisma = new PrismaClient();

async function handleTowerButton(interaction, { prisma }) {
  const customId = interaction.customId;

  // 티켓 구매
  if (customId.startsWith('tower_buy_ticket:')) {
    return await handleBuyTicket(interaction);
  }

  // 도전 시작
  if (customId === 'tower_start') {
    return await handleTowerStart(interaction);
  }

  // 층 도전
  if (customId.startsWith('tower_challenge:')) {
    return await handleChallenge(interaction);
  }

  // 포기
  if (customId === 'tower_give_up') {
    return await handleGiveUp(interaction);
  }

  // 다음 층
  if (customId.startsWith('tower_next:')) {
    return await handleNextFloor(interaction);
  }

  return interaction.reply({ content: '알 수 없는 탑 버튼입니다.', ephemeral: true });
}

// ===== 티켓 구매 =====

async function handleBuyTicket(interaction) {
  const quantity = parseInt(interaction.customId.split(':')[1]);
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  const result = await buyTicket(character.id, quantity);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  await interaction.reply({
    content: [
      result.message,
      `📅 오늘 남은 도전: ${result.remainingTickets}회`,
    ].join('\n'),
    ephemeral: true,
  });
}

// ===== 도전 시작 (버튼) =====

async function handleTowerStart(interaction) {
  const towerCommand = interaction.client.commands.get('tower');
  if (towerCommand) {
    const fakeInteraction = {
      ...interaction,
      options: {
        getSubcommand: () => 'start',
      },
      reply: interaction.update.bind(interaction),
    };
    return await towerCommand.execute(fakeInteraction, { prisma });
  }
}

// ===== 층 도전 (전투 시작) =====

async function handleChallenge(interaction) {
  await interaction.deferUpdate();

  const runId = parseInt(interaction.customId.split(':')[1]);
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
    include: {
      skills: { where: { equipped: true } },
      equipment: true,
      activeParty: {
        include: {
          members: {
            include: {
              character: {
                include: {
                  skills: { where: { equipped: true } },
                  equipment: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!character) {
    return interaction.editReply({ content: '❌ 캐릭터를 찾을 수 없습니다.', components: [] });
  }

  const result = await challengeFloor(runId, character.id);

  if (!result.success) {
    return interaction.editReply({ content: `❌ ${result.error}`, components: [] });
  }

  const { floor, config } = result;

  // 타워 몬스터 데이터
  const monster = {
    name: config.monsterName,
    level: config.monsterLevel,
    hp: config.baseHP,
    maxHp: config.baseHP,
    attack: config.baseATK,
    defense: config.baseDEF,
    imageUrl: config.isBoss
      ? 'https://i.imgur.com/boss_tower.png' // 보스 이미지
      : 'https://i.imgur.com/monster_tower.png', // 일반 이미지
  };

  // 전투 세션 생성
  const session = await initializeCombat(
    character,
    monster,
    'tower',
    `tower_${runId}_${floor}`
  );

  // 전투 UI 생성
  const embed = new EmbedBuilder()
    .setColor(config.isBoss ? EMBED_COLORS.legendary : EMBED_COLORS.combat)
    .setTitle(`🗼 ${floor}층 - ${config.monsterName}`)
    .setDescription(
      [
        createDivider(),
        config.isBoss ? '⚠️ **보스 전투!**' : '',
        '',
        `👤 **${character.name}** (Lv.${character.level})`,
        `   HP: ${character.hp}/${character.maxHp}`,
        `   MP: ${character.mp}/${character.maxMp}`,
        '',
        `👹 **${monster.name}** (Lv.${monster.level})`,
        `   HP: ${monster.hp}/${monster.maxHp}`,
        '',
        createDivider(),
      ]
        .filter(Boolean)
        .join('\n')
    );

  // 전투 버튼
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`combat:attack:${session.id}`)
      .setLabel('공격')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Danger),
  ];

  // 스킬 버튼
  character.skills.slice(0, 3).forEach((skill) => {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`combat:skill:${session.id}:${skill.skillKey}`)
        .setLabel(skill.name)
        .setEmoji('✨')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(character.mp < (skill.manaCost || 0))
    );
  });

  const rows = [new ActionRowBuilder().addComponents(buttons.slice(0, 5))];

  await interaction.editReply({ embeds: [embed], components: rows });

  // 전투 세션에 runId 저장 (전투 종료 시 사용)
  session.towerRunId = runId;
  session.towerFloor = floor;
}

// ===== 포기 =====

async function handleGiveUp(interaction) {
  await interaction.update({
    content: '❌ 도전을 포기했습니다.',
    embeds: [],
    components: [],
  });
}

// ===== 다음 층 =====

async function handleNextFloor(interaction) {
  const runId = parseInt(interaction.customId.split(':')[1]);

  // 다시 도전 시작
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 찾을 수 없습니다.', ephemeral: true });
  }

  const result = await challengeFloor(runId, character.id);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  const { floor, config } = result;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.legendary)
    .setTitle(`🗼 도전자의 탑 - ${floor}층`)
    .setDescription(
      [
        createDivider(),
        config.isBoss ? '⚠️ **보스 층!**' : '⚔️ **일반 층**',
        '',
        `**적:** ${config.monsterName}`,
        `   레벨: ${config.monsterLevel}`,
        `   HP: ${config.baseHP}`,
        `   공격력: ${config.baseATK}`,
        `   방어력: ${config.baseDEF}`,
        '',
        '**보상:**',
        `   💰 골드: ${config.goldReward.toLocaleString()}G`,
        `   ✨ 경험치: ${config.expReward.toLocaleString()}`,
        config.isBoss ? '   🎁 장비 드롭 가능!' : '',
        '',
        createDivider(),
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [
    new ButtonBuilder()
      .setCustomId(`tower_challenge:${runId}`)
      .setLabel('도전하기')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tower_give_up')
      .setLabel('포기')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary),
  ];

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.update({ embeds: [embed], components: rows });
}

module.exports = {
  handleTowerButton,
};
