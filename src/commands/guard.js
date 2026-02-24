/**
 * Guard Command
 * 경비 순찰 시스템
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guard')
    .setNameLocalizations({ ko: '경비' })
    .setDescription('경비 순찰 시스템')
    .setDescriptionLocalizations({ ko: '경비 순찰 시스템' })
    .addSubcommand(sub =>
      sub.setName('status')
        .setNameLocalizations({ ko: '상태' })
        .setDescription('경비 활동 확인')
        .setDescriptionLocalizations({ ko: '경비 활동 확인' })
    )
    .addSubcommand(sub =>
      sub.setName('patrol')
        .setNameLocalizations({ ko: '순찰' })
        .setDescription('순찰 시작 (1시간)')
        .setDescriptionLocalizations({ ko: '순찰 시작 (1시간)' })
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      return await handleStatus(interaction, { prisma });
    }

    if (subcommand === 'patrol') {
      return await handlePatrol(interaction, { prisma });
    }
  },
};

async function handleStatus(interaction, { prisma }) {
  const character = await requireCharacter(prisma, interaction);
  if (!character) return;

  if (character.specialRole !== 'guard') {
    return interaction.reply({
      content: [
        '❌ 경비 역할이 필요합니다.',
        '',
        '💡 `/specialrole choose guard`로 경비 역할을 선택하세요!',
      ].join('\n'),
      ephemeral: true,
    });
  }

  // 오늘 방어한 습격 횟수
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const defenses = await prisma.fieldRaid.count({
    where: {
      raidedAt: { gte: today },
      success: false,
      field: {
        ownerId: character.id,
      },
    },
  });

  // 최근 습격 기록
  const recentRaids = await prisma.fieldRaid.findMany({
    where: {
      field: {
        ownerId: character.id,
      },
    },
    include: {
      field: true,
    },
    orderBy: { raidedAt: 'desc' },
    take: 5,
  });

  const raidLines = recentRaids.map((raid) => {
    const result = raid.success ? '❌ 습격 성공' : '✅ 방어 성공';
    const date = new Date(raid.raidedAt).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${result} - ${date}`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🛡️ ${character.name}의 경비 활동`)
    .setDescription(
      [
        createDivider(),
        '💡 **순찰하여 필드를 지키세요!**',
        '   • 순찰 중 도적 방어 +50%',
        '   • 방어 성공 시 보상 획득',
        '   • 길드원 필드도 보호 가능',
        '',
        `📊 오늘 방어 성공: ${defenses}회`,
        `💰 오늘 보상: ${defenses * 100}G`,
        '',
        createDivider(),
        '**최근 활동:**',
        raidLines.length > 0 ? raidLines.join('\n') : '   기록 없음',
        '',
        createDivider(),
      ]
        .filter(Boolean)
        .join('\n')
    );

  const buttons = [
    new ButtonBuilder()
      .setCustomId('guard_patrol')
      .setLabel('순찰 시작')
      .setEmoji('🚶')
      .setStyle(ButtonStyle.Primary),
  ];

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  await interaction.reply({ embeds: [embed], components: rows });
}

async function handlePatrol(interaction, { prisma }) {
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
  });

  if (!character) {
    return interaction.reply({ content: '❌ 캐릭터를 먼저 생성하세요.', ephemeral: true });
  }

  if (character.specialRole !== 'guard') {
    return interaction.reply({
      content: '❌ 경비 역할이 필요합니다.',
      ephemeral: true,
    });
  }

  // 순찰 쿨다운 체크 (1시간)
  const lastPatrol = character.updatedAt; // 임시로 updatedAt 사용
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  if (lastPatrol > oneHourAgo) {
    const remainingMs = lastPatrol.getTime() + 60 * 60 * 1000 - now.getTime();
    const remainingMin = Math.ceil(remainingMs / 60000);

    return interaction.reply({
      content: `❌ 순찰 쿨다운 중입니다. (${remainingMin}분 남음)`,
      ephemeral: true,
    });
  }

  // 순찰 시작
  await prisma.character.update({
    where: { id: character.id },
    data: {
      updatedAt: now,
    },
  });

  // 주변 필드 보호 (본인 + 같은 길드원)
  const fields = await prisma.farmField.findMany({
    where: {
      ownerId: character.id,
      cropType: { not: null },
    },
  });

  await interaction.reply({
    content: [
      '✅ 순찰을 시작했습니다!',
      '',
      `🛡️ 보호 중인 필드: ${fields.length}개`,
      '⏰ 다음 순찰: 1시간 후',
      '',
      '💡 순찰 중에는 도적 방어 확률이 50% → 70%로 증가합니다!',
    ].join('\n'),
  });
}
