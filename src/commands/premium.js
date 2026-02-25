/**
 * 프리미엄 관련 명령어
 * 
 * - 프리미엄 구독 안내
 * - Ko-fi 링크 제공
 * - 수동 프리미엄 활성화 (관리자)
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { EMBED_COLORS } = require('../utils/ui');
const { createDivider } = require('../utils/ui');

// Ko-fi 링크 (환경 변수 또는 기본값)
const KOFI_LINK = process.env.KOFI_LINK || 'https://ko-fi.com/homeland';
const PATREON_LINK = process.env.PATREON_LINK || null;

// 프리미엄 혜택
const PREMIUM_BENEFITS = [
  '🎁 일일 보상 3배 (젬, 골드, 경험치)',
  '⚡ 자동 전투 모드 (AFK 성장)',
  '🎨 전용 코스메틱 아이템',
  '🏆 우선 지원',
  '✨ 광고 없음',
  '💾 프리미엄 전용 저장 슬롯',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('프리미엄 구독 안내')
    .setNameLocalizations({ 'en-US': 'premium' })
    .setDescriptionLocalizations({ 'en-US': 'Premium subscription information' })
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('프리미엄 혜택 안내')
        .setNameLocalizations({ 'en-US': 'info' })
        .setDescriptionLocalizations({ 'en-US': 'View premium benefits' }),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('내 프리미엄 상태 확인')
        .setNameLocalizations({ 'en-US': 'status' })
        .setDescriptionLocalizations({ 'en-US': 'Check your premium status' }),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('activate')
        .setDescription('[관리자] 프리미엄 수동 활성화')
        .setNameLocalizations({ 'en-US': 'activate' })
        .setDescriptionLocalizations({ 'en-US': '[Admin] Manually activate premium' })
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('프리미엄을 활성화할 사용자')
            .setNameLocalizations({ 'en-US': 'user' })
            .setDescriptionLocalizations({ 'en-US': 'User to activate premium for' })
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('days')
            .setDescription('프리미엄 기간 (일)')
            .setNameLocalizations({ 'en-US': 'days' })
            .setDescriptionLocalizations({ 'en-US': 'Premium duration (days)' })
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(365),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      return handlePremiumInfo(interaction);
    }

    if (subcommand === 'status') {
      return handlePremiumStatus(interaction);
    }

    if (subcommand === 'activate') {
      return handlePremiumActivate(interaction);
    }
  },
};

/**
 * 프리미엄 혜택 안내
 */
async function handlePremiumInfo(interaction) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || '#FFD700')
    .setTitle('💎 프리미엄 구독')
    .setDescription(
      [
        '홈랜드 개발을 지원하고 프리미엄 혜택을 받으세요!',
        '',
        createDivider(),
        '',
        '✨ **프리미엄 혜택:**',
        ...PREMIUM_BENEFITS.map((benefit) => `• ${benefit}`),
        '',
        createDivider(),
        '',
        '💰 **가격: $5/월** (언제든 취소 가능)',
        '',
        '🎁 **첫 달 50% 할인!** 지금만 $2.50',
        '',
        createDivider(),
        '',
        '📋 **구독 방법:**',
        `1. [Ko-fi 링크 클릭](${KOFI_LINK}) ← 여기!`,
        '2. "Support" 또는 "Membership" 버튼 클릭',
        '3. 결제 완료 후 이 Discord에 DM 전송:',
        '   • Ko-fi 이메일 또는 영수증 스크린샷',
        '   • Discord ID (자동 입력됨)',
        '4. ✅ **즉시 프리미엄 활성화!**',
        '',
        createDivider(),
        '',
        '❓ **참고:**',
        '• 프리미엄은 편의 기능만 제공합니다',
        '• 모든 콘텐츠는 무료로 즐기실 수 있습니다',
        '• 언제든지 취소 가능합니다',
      ].join('\n'),
    )
    .setFooter({
      text: '지원해주셔서 감사합니다! ❤️',
    });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * 프리미엄 상태 확인
 */
async function handlePremiumStatus(interaction) {
  const prisma = interaction.client.prisma;
  const userId = interaction.user.id;

  const character = await prisma.character.findUnique({
    where: { userId },
    select: {
      premiumUntil: true,
    },
  });

  if (!character) {
    await interaction.reply({
      content: '캐릭터를 먼저 생성해주세요. (`/create`)',
      ephemeral: true,
    });
    return;
  }

  const isPremium = character.premiumUntil && new Date(character.premiumUntil) > new Date();

  if (!isPremium) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.error || '#FF0000')
      .setTitle('💎 프리미엄 상태')
      .setDescription(
        [
          '현재 프리미엄 구독이 없습니다.',
          '',
          `프리미엄 혜택을 받으시려면 \`/premium info\` 명령어를 확인하세요!`,
        ].join('\n'),
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return;
  }

  const daysLeft = Math.ceil((new Date(character.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24));

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || '#FFD700')
    .setTitle('💎 프리미엄 활성화됨!')
    .setDescription(
      [
        '✅ **프리미엄 구독 중**',
        '',
        `⏰ **남은 기간:** ${daysLeft}일`,
        `📅 **만료일:** ${new Date(character.premiumUntil).toLocaleDateString('ko-KR')}`,
        '',
        '✨ **활성 혜택:**',
        ...PREMIUM_BENEFITS.map((benefit) => `• ${benefit}`),
      ].join('\n'),
    )
    .setFooter({
      text: '지원해주셔서 감사합니다! ❤️',
    });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * 프리미엄 수동 활성화 (관리자만)
 */
async function handlePremiumActivate(interaction) {
  // 관리자 권한 체크
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const days = interaction.options.getInteger('days');
  const prisma = interaction.client.prisma;

  const character = await prisma.character.findUnique({
    where: { userId: targetUser.id },
  });

  if (!character) {
    await interaction.reply({
      content: `❌ ${targetUser.username}님은 캐릭터가 없습니다.`,
      ephemeral: true,
    });
    return;
  }

  // 프리미엄 기간 설정
  const now = new Date();
  const premiumUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.character.update({
    where: { id: character.id },
    data: {
      premiumUntil,
    },
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.success || '#00FF00')
    .setTitle('✅ 프리미엄 활성화 완료')
    .setDescription(
      [
        `**사용자:** ${targetUser.username}`,
        `**기간:** ${days}일`,
        `**만료일:** ${premiumUntil.toLocaleDateString('ko-KR')}`,
        '',
        '프리미엄이 정상적으로 활성화되었습니다!',
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });

  // 사용자에게 DM 전송 시도
  try {
    const userEmbed = new EmbedBuilder()
      .setColor(EMBED_COLORS.premium || '#FFD700')
      .setTitle('🎉 프리미엄 활성화!')
      .setDescription(
        [
          `축하합니다! ${days}일간 프리미엄이 활성화되었습니다!`,
          '',
          '✨ **혜택:**',
          ...PREMIUM_BENEFITS.map((benefit) => `• ${benefit}`),
          '',
          `만료일: ${premiumUntil.toLocaleDateString('ko-KR')}`,
        ].join('\n'),
      )
      .setFooter({
        text: '지원해주셔서 감사합니다! ❤️',
      });

    await targetUser.send({ embeds: [userEmbed] });
  } catch (error) {
    // DM 실패 시 무시 (DM 비활성화 등)
    console.log(`Could not send DM to ${targetUser.username}`);
  }
}
