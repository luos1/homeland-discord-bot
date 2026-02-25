/**
 * Tower of Challengers Command
 * 도전자의 탑
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');
const {
  TOWER_CONFIG,
  getFloorConfig,
  buyTicket,
  startTowerRun,
  getTowerRanking,
  getMyRecord,
} = require('../game/tower-system');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tower')
		.setNameLocalizations({ "en-US": "tower" })
    .setDescription('도전자의 탑')
		.setDescriptionLocalizations({ "en-US": "도전자의 탑" })
    .setDescriptionLocalizations({ ko: '도전자의 탑' })
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('탑 정보')
        .setDescriptionLocalizations({ ko: '탑 정보' })
    )
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('도전 시작')
        .setDescriptionLocalizations({ ko: '도전 시작' })
    )
    .addSubcommand(sub =>
      sub.setName('record')
        .setDescription('내 기록')
        .setDescriptionLocalizations({ ko: '내 기록' })
    )
    .addSubcommand(sub =>
      sub.setName('ranking')
        .setDescription('전체 랭킹')
        .setDescriptionLocalizations({ ko: '전체 랭킹' })
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      return await handleInfo(interaction, { prisma });
    }

    if (subcommand === 'start') {
      return await handleStart(interaction, { prisma });
    }

    if (subcommand === 'record') {
      return await handleRecord(interaction, { prisma });
    }

    if (subcommand === 'ranking') {
      return await handleRanking(interaction, { prisma });
    }
  },
};

async function handleInfo(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  const record = await getMyRecord(character.id);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.legendary)
    .setTitle('🗼 도전자의 탑')
    .setDescription(
      [
        createDivider(),
        '💡 **100층의 탑을 정복하세요!**',
        '',
        '**규칙:**',
        '• 티켓 구매: 1,000G/회',
        `• 일일 도전: ${TOWER_CONFIG.dailyTickets}회`,
        '• 층마다 강력한 적 등장',
        '• 10층마다 보스 출현',
        '• 실패 시 현재 층 기록',
        '• 다음 도전 시 최고 층부터 시작',
        '',
        '**보상:**',
        '• 골드 + 경험치',
        '• 10층마다 장비 드롭',
        '• 25층마다 스킬북',
        '• 첫 클리어 시 보상 2배!',
        '',
        createDivider(),
        `📊 내 최고 기록: ${record.highestFloor}층`,
        record.rank ? `🏆 랭킹: ${record.rank}위` : '',
        '',
        '💡 `/tower start`로 도전 시작!',
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [
    new ButtonBuilder()
      .setCustomId('tower_buy_ticket:1')
      .setLabel('티켓 구매 (1,000G)')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(character.gold < TOWER_CONFIG.ticketCost),
    new ButtonBuilder()
      .setCustomId('tower_start')
      .setLabel('도전 시작')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Success),
  ];

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.reply({ embeds: [embed], components: rows });
}

async function handleStart(interaction, { prisma }) {
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  // 오늘 도전 횟수 확인
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayRuns = await prisma.towerRun.count({
    where: {
      characterId: character.id,
      createdAt: { gte: today },
    },
  });

  if (todayRuns >= TOWER_CONFIG.dailyTickets) {
    return interaction.reply({
      content: `❌ 오늘 도전 횟수를 모두 사용했습니다. (${TOWER_CONFIG.dailyTickets}회/일)\n💡 내일 다시 도전하세요!`,
      ephemeral: true,
    });
  }

  const result = await startTowerRun(character.id);

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
        `📊 남은 도전: ${TOWER_CONFIG.dailyTickets - todayRuns - 1}회`,
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [
    new ButtonBuilder()
      .setCustomId(`tower_challenge:${result.run.id}`)
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

  await interaction.reply({ embeds: [embed], components: rows });
}

async function handleRecord(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  const record = await getMyRecord(character.id);

  // 오늘 도전 횟수
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayRuns = await prisma.towerRun.count({
    where: {
      characterId: character.id,
      createdAt: { gte: today },
    },
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🗼 ${character.name}의 탑 기록`)
    .setDescription(
      [
        createDivider(),
        `🏆 최고 층수: ${record.highestFloor}층`,
        `📊 총 클리어: ${record.totalClears}회`,
        record.rank ? `🥇 랭킹: ${record.rank}위` : '',
        '',
        createDivider(),
        `📅 오늘 도전: ${todayRuns}/${TOWER_CONFIG.dailyTickets}회`,
        todayRuns < TOWER_CONFIG.dailyTickets
          ? `💡 ${TOWER_CONFIG.dailyTickets - todayRuns}회 더 도전할 수 있습니다!`
          : '💡 내일 다시 도전하세요!',
      ]
        .filter(Boolean)
        .join('\n')
    );

  await interaction.reply({ embeds: [embed] });
}

async function handleRanking(interaction, { prisma }) {
  const ranking = await getTowerRanking(10);

  const rankLines = ranking.map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} **${r.character.name}** (Lv.${r.character.level} ${r.character.class}) - ${r.highestFloor}층`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.legendary)
    .setTitle('🗼 도전자의 탑 랭킹')
    .setDescription(
      [
        createDivider(),
        ...rankLines,
        '',
        createDivider(),
        '💡 `/tower start`로 도전하세요!',
      ].join('\n')
    );

  await interaction.reply({ embeds: [embed] });
}
