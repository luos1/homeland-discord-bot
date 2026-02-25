const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const {
  INVITE_REWARD_AMOUNTS,
  applyInviteUseRewards,
  calculateRewardTotals,
  decodeInviteCode,
  generateInviteCode,
  normalizeInviteCode,
  normalizeRewardState,
  REWARD_FLAGS,
} = require('../game/invite-rewards');
const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');

const INVITE_LEVEL_LIMIT = 5;
const RANKING_LIMIT = 10;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getCurrentMonthRangeKst(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth();

  const startKst = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endKst = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  return {
    startUtc: new Date(startKst.getTime() - KST_OFFSET_MS),
    endUtc: new Date(endKst.getTime() - KST_OFFSET_MS),
    label: `${year}년 ${month + 1}월`,
  };
}

function getMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}위`;
}

function formatRecordDate(date) {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function buildInviteStatusLine(record) {
  const rewardState = normalizeRewardState(record.rewardsClaimed);
  const inviteeLevel = record.invitee?.level || record.inviteeLevel || 1;

  const milestoneText = [
    `가입:${rewardState[REWARD_FLAGS.inviterOnJoin] ? '✅' : '❌'}`,
    `Lv10:${rewardState[REWARD_FLAGS.inviterOnLevel10] ? '✅' : '⏳'}`,
    `Lv30:${rewardState[REWARD_FLAGS.inviterOnLevel30] ? '✅' : '⏳'}`,
  ].join(' | ');

  return [
    `• **${record.invitee?.name || `캐릭터 #${record.inviteeId}`}** (Lv.${inviteeLevel})`,
    `  └ ${milestoneText} · 초대일 ${formatRecordDate(record.createdAt)}`,
  ].join('\n');
}

function sumInviteRewards(records) {
  return records.reduce(
    (acc, record) => {
      const totals = calculateRewardTotals(record.rewardsClaimed);
      const rewardState = normalizeRewardState(record.rewardsClaimed);

      acc.inviterGems += totals.inviterGems;
      acc.inviteeGold += totals.inviteeGold;
      acc.inviteeGems += totals.inviteeGems;

      if (!rewardState[REWARD_FLAGS.inviterOnLevel10]) {
        acc.pendingInviterGems += INVITE_REWARD_AMOUNTS.inviterOnLevel10Gems;
      }

      if (!rewardState[REWARD_FLAGS.inviterOnLevel30]) {
        acc.pendingInviterGems += INVITE_REWARD_AMOUNTS.inviterOnLevel30Gems;
      }

      return acc;
    },
    {
      inviterGems: 0,
      inviteeGold: 0,
      inviteeGems: 0,
      pendingInviterGems: 0,
    },
  );
}

async function handleInviteCode(interaction, prisma) {
  const character = await requireCharacter(prisma, interaction);

  if (!character) {
    return;
  }

  const inviteCode = generateInviteCode(character.userId);
  const inviteCount = await prisma.inviteRecord.count({
    where: {
      inviterId: character.id,
    },
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🎟️ 내 친구 초대 코드')
    .setDescription(
      [
        createDivider(),
        `초대 코드: \`${inviteCode}\``,
        '',
        '사용 방법',
        '• 친구가 `/invite use 코드:<내 코드>` 입력',
        `• 친구는 캐릭터 생성 직후 또는 Lv.${INVITE_LEVEL_LIMIT} 이하일 때만 등록 가능`,
        '',
        `📊 지금까지 초대한 친구: ${formatNumber(inviteCount)}명`,
        createDivider(),
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handleInviteUse(interaction, prisma) {
  const inviteCodeInput = interaction.options.getString('code', true);
  const inviteCode = normalizeInviteCode(inviteCodeInput);

  const character = await requireCharacter(prisma, interaction);
  if (!character) {
    return;
  }

  if (character.level > INVITE_LEVEL_LIMIT) {
    await interaction.reply({
      content: `초대 코드는 캐릭터 생성 직후 또는 Lv.${INVITE_LEVEL_LIMIT} 이하에서만 사용할 수 있습니다.`,
      ephemeral: true,
    });
    return;
  }

  const inviterUserId = decodeInviteCode(inviteCode);

  if (!inviterUserId) {
    await interaction.reply({
      content: '유효하지 않은 초대 코드입니다. 코드를 다시 확인해주세요.',
      ephemeral: true,
    });
    return;
  }

  if (inviterUserId === character.userId) {
    await interaction.reply({
      content: '본인 초대 코드는 사용할 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const existingRecord = await prisma.inviteRecord.findUnique({
    where: {
      inviteeId: character.id,
    },
    include: {
      inviter: {
        select: {
          name: true,
        },
      },
    },
  });

  if (existingRecord) {
    await interaction.reply({
      content: `이미 초대 코드가 등록되어 있습니다. (초대한 사람: ${existingRecord.inviter?.name || '알 수 없음'})`,
      ephemeral: true,
    });
    return;
  }

  const inviterCharacter = await prisma.character.findUnique({
    where: {
      userId: inviterUserId,
    },
    select: {
      id: true,
      name: true,
      userId: true,
    },
  });

  if (!inviterCharacter) {
    await interaction.reply({
      content: '초대 코드를 찾을 수 없습니다. 코드 보유자가 아직 캐릭터를 생성하지 않았을 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  if (inviterCharacter.id === character.id) {
    await interaction.reply({
      content: '본인 초대 코드는 사용할 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  try {
    await applyInviteUseRewards(prisma, {
      inviterCharacterId: inviterCharacter.id,
      inviteeCharacterId: character.id,
      inviteCode,
      inviteeLevel: character.level,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      await interaction.reply({
        content: '이미 초대 코드가 등록된 캐릭터입니다.',
        ephemeral: true,
      });
      return;
    }

    console.error('invite use 처리 실패:', error);
    await interaction.reply({
      content: '초대 코드 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.victory)
    .setTitle('🎉 친구 초대 등록 완료!')
    .setDescription(
      [
        createDivider(),
        `초대한 사람: **${inviterCharacter.name}**`,
        '',
        '즉시 지급 보상',
        `• 초대한 사람: 💠 보석 +${formatNumber(INVITE_REWARD_AMOUNTS.inviterOnJoinGems)}`,
        `• 나: 💰 골드 +${formatNumber(INVITE_REWARD_AMOUNTS.inviteeOnJoinGold)}`,
        '',
        '추가 보상',
        `• 내가 Lv.10 달성 시: 초대한 사람 💠 +${formatNumber(INVITE_REWARD_AMOUNTS.inviterOnLevel10Gems)}, 나 💠 +${formatNumber(INVITE_REWARD_AMOUNTS.inviteeOnLevel10Gems)}`,
        `• 내가 Lv.30 달성 시: 초대한 사람 💠 +${formatNumber(INVITE_REWARD_AMOUNTS.inviterOnLevel30Gems)}`,
        createDivider(),
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handleInviteStatus(interaction, prisma) {
  const character = await requireCharacter(prisma, interaction);

  if (!character) {
    return;
  }

  const records = await prisma.inviteRecord.findMany({
    where: {
      inviterId: character.id,
    },
    include: {
      invitee: {
        select: {
          name: true,
          level: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const inviteCode = generateInviteCode(character.userId);

  if (records.length === 0) {
    await interaction.reply({
      content: ['아직 초대한 친구가 없습니다.', `내 코드: \`${inviteCode}\``].join('\n'),
      ephemeral: true,
    });
    return;
  }

  const totals = sumInviteRewards(records);
  const lines = records.map((record) => buildInviteStatusLine(record));

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('📋 친구 초대 현황')
    .setDescription(
      [
        createDivider(),
        `내 코드: \`${inviteCode}\``,
        `초대한 친구: ${formatNumber(records.length)}명`,
        `지급된 내 보석: 💠 ${formatNumber(totals.inviterGems)}`,
        `앞으로 받을 수 있는 보석(최대): 💠 ${formatNumber(totals.pendingInviterGems)}`,
        createDivider(),
        '',
        ...lines,
      ].join('\n'),
    )
    .setFooter({
      text: '상태: 가입(즉시) / Lv10 / Lv30',
    });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handleInviteRanking(interaction, prisma) {
  const monthRange = getCurrentMonthRangeKst();

  const grouped = await prisma.inviteRecord.groupBy({
    by: ['inviterId'],
    where: {
      createdAt: {
        gte: monthRange.startUtc,
        lt: monthRange.endUtc,
      },
    },
    _count: {
      _all: true,
    },
  });

  const rows = grouped
    .map((entry) => ({
      inviterId: entry.inviterId,
      count: entry._count._all || 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.inviterId - b.inviterId);

  const inviterIds = rows.map((entry) => entry.inviterId);
  const characters = inviterIds.length > 0
    ? await prisma.character.findMany({
      where: {
        id: {
          in: inviterIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })
    : [];

  const nameById = new Map(characters.map((character) => [character.id, character.name]));

  const topLines = rows.slice(0, RANKING_LIMIT).map((entry, index) => {
    const rank = index + 1;
    const medal = getMedal(rank);
    const name = nameById.get(entry.inviterId) || `캐릭터 #${entry.inviterId}`;
    return `${medal} **${name}** · ${formatNumber(entry.count)}명`;
  });

  const myCharacter = await prisma.character.findUnique({
    where: {
      userId: interaction.user.id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  let myRankText = '집계 기록 없음';

  if (myCharacter) {
    const myIndex = rows.findIndex((entry) => entry.inviterId === myCharacter.id);

    if (myIndex >= 0) {
      myRankText = `${myIndex + 1}위 · ${formatNumber(rows[myIndex].count)}명 초대`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.levelUp)
    .setTitle(`🏆 친구 초대 랭킹 (${monthRange.label})`)
    .setDescription(
      [
        createDivider(),
        ...(topLines.length > 0 ? topLines : ['이번 달 초대 기록이 아직 없습니다.']),
        createDivider(),
      ].join('\n'),
    )
    .addFields({
      name: '내 순위',
      value: myRankText,
      inline: false,
    });

  await interaction.reply({
    embeds: [embed],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('친구 초대 코드를 공유하고 보상을 확인합니다')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('code')
        .setDescription('내 초대 코드를 생성/확인합니다'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('use')
        .setDescription('친구의 초대 코드를 등록합니다')
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('사용할 초대 코드')
            .setRequired(true)
            .setMinLength(4)
            .setMaxLength(80),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('내 초대 현황과 보상 지급 상태를 확인합니다'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ranking')
        .setDescription('이번 달 친구 초대 랭킹을 확인합니다'),
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand(true);

    if (subcommand === 'code') {
      await handleInviteCode(interaction, prisma);
      return;
    }

    if (subcommand === 'use') {
      await handleInviteUse(interaction, prisma);
      return;
    }

    if (subcommand === 'status') {
      await handleInviteStatus(interaction, prisma);
      return;
    }

    if (subcommand === 'ranking') {
      await handleInviteRanking(interaction, prisma);
      return;
    }

    await interaction.reply({
      content: '지원하지 않는 초대 명령입니다.',
      ephemeral: true,
    });
  },
};
