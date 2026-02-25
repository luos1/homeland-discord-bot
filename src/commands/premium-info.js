const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { getAllTiers } = require('../game/premium-tiers');

/**
 * Tier 비교 Embed 생성
 */
function createTierComparisonEmbed(page = 1) {
  const tiers = getAllTiers();
  const description = [];

  if (page === 1) {
    // Page 1: 일회성 상품 + 기본 구독
    description.push(
      createDivider(),
      '💎 **Homeland Premium - 플랜 비교**',
      '',
      '**📱 Starter Pack** - $2.99 (일회성)',
      '• ⏱️ 48시간 부스트',
      '• 📈 경험치 +100% (48h)',
      '• 💰 골드 +50% (48h)',
      '• 🪙 골드 1,000개 즉시',
      '• 💎 젬 50개 즉시',
      '• 🎁 레어 무기 상자 x1',
      '',
      '**🥉 Bronze** - $4.99/월',
      '• 📈 경험치 +20%',
      '• 💰 골드 +15%',
      '• ⚡ 오토 배틀 10회/일',
      '• 💎 매일 젬 10개',
      '• 🏷️ 특별 칭호 1개',
      '',
      '**🥈 Silver** - $9.99/월',
      '• 📈 경험치 +40%',
      '• 💰 골드 +30%',
      '• ⚡ 오토 배틀 30회/일',
      '• 💎 매일 젬 25개',
      '• ✨ 전용 스킬 2종',
      '• 🏷️ 특별 칭호 3개',
      '• 👥 길드 슬롯 +5',
      '',
      '**🥇 Gold** - $19.99/월',
      '• 📈 경험치 +60%',
      '• 💰 골드 +50%',
      '• ⚡ 오토 배틀 무제한',
      '• 💎 매일 젬 50개',
      '• ✨ 전용 스킬 3종',
      '• 🏰 전용 레이드',
      '• 🎁 주간 전설 상자',
      '• 💸 거래 수수료 50% 할인',
      '',
      createDivider(),
      '다음 페이지에서 프리미엄 플랜을 확인하세요 →'
    );
  } else {
    // Page 2: 프리미엄 구독
    description.push(
      createDivider(),
      '💎 **Homeland Premium - 프리미엄 플랜**',
      '',
      '**💎 Diamond** - $34.99/월',
      '• 📈 경험치 +100% (2배!)',
      '• 💰 골드 +75%',
      '• ⚡ 오토 배틀 무제한',
      '• 💎 매일 젬 100개',
      '• ✨ 전용 스킨 3개/월',
      '• 🏷️ 커스텀 칭호 제작',
      '• ⚔️ PvP 시즌 보상 2배',
      '• 👥 길드 슬롯 +15',
      '',
      '**👑 Elite** - $49.99/월',
      '• 📈 경험치 +150%',
      '• 💰 골드 +100% (2배!)',
      '• ⚡ 오토 배틀 무제한',
      '• 💎 매일 젬 200개',
      '• ✨ 전용 스킨 5개/월',
      '• 🐉 독점 레전더리 펫',
      '• 🛡️ 서버 아이콘 배지',
      '• 💬 월간 개발자 Q&A',
      '• 🧪 베타 테스트 우선권',
      '',
      '**🔥 Founder Pack** - $99.99 (평생)',
      '• 🔥 평생 Elite 혜택',
      '• 🏷️ 독점 "Founder" 칭호',
      '• 📜 게임 크레딧 이름 등재',
      '• 🗳️ 개발 로드맵 투표권',
      '• 🎭 이벤트 NPC로 등장',
      '• ⚠️ 선착순 100명 한정',
      '',
      createDivider(),
      '← 이전 페이지에서 기본 플랜 확인'
    );
  }

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || EMBED_COLORS.victory)
    .setTitle(page === 1 ? '💎 Premium 플랜 비교 (1/2)' : '💎 Premium 플랜 비교 (2/2)')
    .setDescription(description.join('\n'))
    .setFooter({ 
      text: page === 1 
        ? '구독 플랜: 7일 무료 체험 + 첫 달 30% 할인' 
        : 'Founder Pack: 선착순 100명 한정, 조기 품절 가능' 
    });
}

/**
 * 페이지 네비게이션 버튼
 */
function createNavigationButtons(page = 1) {
  const buttons = [];

  if (page > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('premium:info:prev')
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (page < 2) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('premium:info:next')
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('premium:info:subscribe')
      .setLabel('구독하기')
      .setEmoji('💳')
      .setStyle(ButtonStyle.Success)
  );

  return new ActionRowBuilder().addComponents(buttons);
}

/**
 * 특별 혜택 Embed
 */
function createBenefitsEmbed() {
  const description = [
    createDivider(),
    '🎁 **특별 혜택**',
    '',
    '**🆓 7일 무료 체험**',
    '• 모든 구독 플랜에서 7일 무료 체험',
    '• 체험 기간 중 언제든지 취소 가능',
    '• 자동 청구 전 알림',
    '',
    '**💰 첫 구독 30% 할인**',
    '• 첫 달 30% 할인 혜택',
    '• 모든 구독 플랜 적용',
    '• 코드: FIRST30',
    '',
    '**🔥 Founder Pack 한정**',
    '• 선착순 100명만 구매 가능',
    '• $99.99로 평생 Elite 혜택',
    '• 독점 칭호 + 크레딧 등재',
    '• 조기 품절 가능성 높음',
    '',
    '**💳 안전한 결제**',
    '• Stripe 결제 시스템',
    '• 언제든지 구독 취소 가능',
    '• 환불 정책: 7일 이내 전액 환불',
    '',
    createDivider(),
  ];

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || EMBED_COLORS.victory)
    .setTitle('🎁 Premium 특별 혜택')
    .setDescription(description.join('\n'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium-info')
    .setDescription('Premium 플랜 비교 및 혜택을 확인합니다'),

  async execute(interaction, { prisma }) {
    await interaction.reply({
      embeds: [createTierComparisonEmbed(1)],
      components: [createNavigationButtons(1)],
      ephemeral: true,
    });
  },

  async handleButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith('premium:info:')) {
      return false;
    }

    // 다음 페이지
    if (interaction.customId === 'premium:info:next') {
      await interaction.update({
        embeds: [createTierComparisonEmbed(2)],
        components: [createNavigationButtons(2)],
      });
      return true;
    }

    // 이전 페이지
    if (interaction.customId === 'premium:info:prev') {
      await interaction.update({
        embeds: [createTierComparisonEmbed(1)],
        components: [createNavigationButtons(1)],
      });
      return true;
    }

    // 구독하기
    if (interaction.customId === 'premium:info:subscribe') {
      // premium-subscribe 명령어로 리다이렉트
      const { execute: subscribeExecute } = require('./premium-subscribe');
      await subscribeExecute(interaction, { prisma });
      return true;
    }

    return false;
  },
};
