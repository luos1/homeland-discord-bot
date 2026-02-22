const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const {
  PREMIUM_PLAN,
  PREMIUM_PLAN_ID,
  buildPremiumPeriod,
  formatPremiumPrice,
  getStripePremiumReadiness,
  isPremiumSubscriptionActive,
  resolvePremiumBenefits,
} = require('../game/premium');

function formatDate(date) {
  return new Date(date).toLocaleString('ko-KR', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createStatusEmbed({ character, subscription, now = new Date() }) {
  const benefits = resolvePremiumBenefits(subscription, now);
  const stripeState = getStripePremiumReadiness();

  const descriptionLines = [
    createDivider(),
    `🧑 캐릭터: ${character.name}`,
    `💰 보유 골드: ${formatNumber(character.gold)}G`,
    `💎 보유 젬: ${formatNumber(character.gems || 0)}`,
    '',
    `💳 플랜: ${PREMIUM_PLAN.label} (${formatPremiumPrice()}/월)`,
    `📌 상태: ${benefits.active ? '활성' : '비활성'}`,
  ];

  if (benefits.active && subscription) {
    descriptionLines.push(`🗓️ 구독 종료일: ${formatDate(subscription.endDate)}`);
  }

  descriptionLines.push(
    '',
    '🎁 Premium 혜택',
    `⚔️ 전투 경험치 +${Math.round((PREMIUM_PLAN.xpMultiplier - 1) * 100)}%`,
    `💰 전투 골드 +${Math.round((PREMIUM_PLAN.goldMultiplier - 1) * 100)}%`,
    `💠 일일 젬 +${PREMIUM_PLAN.dailyGemBonus}`,
    '',
    createDivider(),
    `🔌 Stripe 준비 상태: ${stripeState.ready ? '준비 완료' : '설정 필요'}`,
  );

  if (!stripeState.ready) {
    descriptionLines.push(`누락 키: ${stripeState.missingKeys.join(', ')}`);
  }

  return new EmbedBuilder()
    .setColor(benefits.active ? EMBED_COLORS.victory : EMBED_COLORS.profile)
    .setTitle('💎 Premium Pass')
    .setDescription(descriptionLines.join('\n'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Premium Pass 구독 상태를 관리합니다')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Premium Pass 상태와 혜택을 확인합니다'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('subscribe')
        .setDescription('월 $9.99 Premium Pass를 구독합니다'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Premium Pass 구독을 해지합니다'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('content')
        .setDescription('프리미엄 전용 컨텐츠(준비중)를 확인합니다'),
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

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

    const now = new Date();
    const existing = await prisma.premiumSubscription.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });
    const active = isPremiumSubscriptionActive(existing, now);

    if (subcommand === 'status') {
      await interaction.reply({
        embeds: [
          createStatusEmbed({
            character,
            subscription: existing,
            now,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'subscribe') {
      const durationMs = PREMIUM_PLAN.durationDays * 24 * 60 * 60 * 1000;
      const nextStart = active ? new Date(existing.startDate) : buildPremiumPeriod(now).startDate;
      const nextEnd = active
        ? new Date(new Date(existing.endDate).getTime() + durationMs)
        : buildPremiumPeriod(now).endDate;

      const subscription = await prisma.premiumSubscription.upsert({
        where: {
          userId: interaction.user.id,
        },
        update: {
          planId: PREMIUM_PLAN_ID,
          startDate: nextStart,
          endDate: nextEnd,
        },
        create: {
          userId: interaction.user.id,
          planId: PREMIUM_PLAN_ID,
          startDate: nextStart,
          endDate: nextEnd,
        },
      });

      const stripeState = getStripePremiumReadiness();

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.victory)
        .setTitle('✅ Premium Pass 활성화')
        .setDescription(
          [
            createDivider(),
            `플랜: ${PREMIUM_PLAN.label} (${formatPremiumPrice()}/월)`,
            `시작일: ${formatDate(subscription.startDate)}`,
            `종료일: ${formatDate(subscription.endDate)}`,
            '',
            `⚔️ 경험치 +${Math.round((PREMIUM_PLAN.xpMultiplier - 1) * 100)}%`,
            `💰 골드 +${Math.round((PREMIUM_PLAN.goldMultiplier - 1) * 100)}%`,
            `💠 일일 젬 +${PREMIUM_PLAN.dailyGemBonus}`,
            '',
            createDivider(),
            stripeState.ready
              ? '🔌 Stripe 설정이 감지되었습니다. 결제 연동 준비가 완료되었습니다.'
              : `🔌 Stripe 연동 준비 중 (누락: ${stripeState.missingKeys.join(', ')})`,
          ].join('\n'),
        );

      await interaction.reply({
        embeds: [embed],
      });

      return;
    }

    if (subcommand === 'cancel') {
      if (!active) {
        await interaction.reply({
          content: '활성 Premium Pass가 없습니다.',
          ephemeral: true,
        });
        return;
      }

      await prisma.premiumSubscription.update({
        where: {
          userId: interaction.user.id,
        },
        data: {
          endDate: now,
        },
      });

      await interaction.reply({
        content: 'Premium Pass를 해지했습니다. 해지 시각부터 혜택이 중단됩니다.',
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'content') {
      if (!active) {
        await interaction.reply({
          content: '프리미엄 전용 컨텐츠는 Premium Pass 활성화 후 이용할 수 있습니다.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.profile)
        .setTitle('🧩 Premium 전용 컨텐츠')
        .setDescription(
          [
            createDivider(),
            '프리미엄 전용 던전/보상 트랙을 준비 중입니다.',
            '이번 업데이트에서는 접근 게이트와 구독 연동만 선반영되었습니다.',
            '',
            `현재 구독 만료: ${formatDate(existing.endDate)}`,
            createDivider(),
          ].join('\n'),
        );

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
