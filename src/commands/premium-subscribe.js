const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const { EMBED_COLORS, createDivider } = require('../utils/ui');
const { requireCharacter } = require('../utils/response-helpers');
const { getAllTiers } = require('../game/premium-tiers');

const PREMIUM_SUBSCRIBE_PREFIX = 'premium:subscribe:';

/**
 * Premium Tier 선택 UI 생성
 */
function createTierSelectionEmbed() {
  const tiers = getAllTiers();
  
  const description = [
    createDivider(),
    '💎 **Homeland Premium - 7 Tier 시스템**',
    '',
    '원하는 플랜을 선택하세요:',
    '',
  ];

  // Tier 목록 표시
  for (const tier of tiers) {
    const tierType = tier.type === 'one_time' 
      ? '일회성' 
      : tier.type === 'lifetime' 
      ? '평생' 
      : '월간 구독';
    
    description.push(
      `${tier.emoji} **${tier.name}** - $${tier.price} (${tierType})`
    );
    
    // 주요 혜택 3개만 표시
    const topBenefits = tier.description.slice(0, 3);
    topBenefits.forEach(benefit => {
      description.push(`  ${benefit}`);
    });
    description.push('');
  }

  description.push(
    createDivider(),
    '🎁 **특별 혜택**',
    '• 7일 무료 체험 (구독 플랜)',
    '• 첫 구독 30% 할인',
    '• Founder Pack 선착순 100명 한정',
    '',
    '자세한 내용은 `/premium info` 명령어로 확인하세요.'
  );

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || EMBED_COLORS.victory)
    .setTitle('💎 Premium 구독하기')
    .setDescription(description.join('\n'))
    .setFooter({ text: '안전한 결제는 Stripe로 처리됩니다' });
}

/**
 * Tier 선택 메뉴 생성
 */
function createTierSelectMenu() {
  const tiers = getAllTiers();
  
  const options = tiers.map(tier => {
    const tierType = tier.type === 'one_time' 
      ? '일회성' 
      : tier.type === 'lifetime' 
      ? '평생' 
      : '월간';
    
    let label = `${tier.name} - $${tier.price}`;
    let description = `${tierType}`;
    
    // Founder Pack 한정 표시
    if (tier.limited) {
      description += ` (선착순 ${tier.limited}명)`;
    }

    return {
      label,
      description,
      value: tier.id,
      emoji: tier.emoji,
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(`${PREMIUM_SUBSCRIBE_PREFIX}select`)
    .setPlaceholder('플랜을 선택하세요')
    .addOptions(options);
}

/**
 * Tier 확인 페이지
 */
function createTierConfirmEmbed(tier) {
  const tierType = tier.type === 'one_time' 
    ? '일회성 결제' 
    : tier.type === 'lifetime' 
    ? '평생 혜택 (일회성 결제)' 
    : '월간 구독';

  const description = [
    createDivider(),
    `${tier.emoji} **${tier.name}**`,
    `💵 가격: $${tier.price} (${tierType})`,
    '',
    '**📜 혜택:**',
    ...tier.description,
    '',
    createDivider(),
  ];

  // 무료 체험 표시 (구독 플랜만)
  if (tier.type === 'subscription') {
    description.push(
      '🎁 **7일 무료 체험**',
      '• 7일 동안 무료로 모든 혜택 이용',
      '• 체험 기간 중 언제든지 취소 가능',
      '• 취소하지 않으면 자동으로 구독 시작',
      ''
    );
  }

  // 첫 구독 할인 (구독 플랜만)
  if (tier.type === 'subscription') {
    description.push(
      '💰 **첫 구독 30% 할인**',
      `• 첫 달 $${(tier.price * 0.7).toFixed(2)} (30% 할인)`,
      '• 다음 달부터 정상 가격',
      ''
    );
  }

  // Founder Pack 한정 표시
  if (tier.limited) {
    description.push(
      '⚠️ **한정 판매**',
      `• 선착순 ${tier.limited}명만 구매 가능`,
      '• 조기 품절 가능성 있음',
      ''
    );
  }

  description.push(
    createDivider(),
    '아래 버튼을 눌러 결제 페이지로 이동합니다.'
  );

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || EMBED_COLORS.victory)
    .setTitle('💳 결제 확인')
    .setDescription(description.join('\n'));
}

/**
 * 결제 버튼
 */
function createPaymentButtons(tierId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREMIUM_SUBSCRIBE_PREFIX}confirm:${tierId}`)
      .setLabel('결제하기')
      .setEmoji('💳')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${PREMIUM_SUBSCRIBE_PREFIX}cancel`)
      .setLabel('취소')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Stripe Checkout 세션 생성 (실제 구현은 payment-stripe.js에서)
 */
async function createCheckoutSession(userId, tierId) {
  // TODO: Stripe Checkout 세션 생성
  // 이 부분은 src/game/payment-stripe.js에서 구현
  const checkoutUrl = `https://checkout.stripe.com/...?tier=${tierId}&user=${userId}`;
  return checkoutUrl;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium-subscribe')
    .setDescription('Premium 구독 플랜을 선택합니다'),

  async execute(interaction, { prisma }) {
    const character = await requireCharacter(prisma, interaction);
    if (!character) return;

    await interaction.reply({
      embeds: [createTierSelectionEmbed()],
      components: [
        new ActionRowBuilder().addComponents(createTierSelectMenu())
      ],
      ephemeral: true,
    });
  },

  async handleSelectMenu(interaction, { prisma }) {
    if (!interaction.customId.startsWith(PREMIUM_SUBSCRIBE_PREFIX)) {
      return false;
    }

    if (interaction.customId === `${PREMIUM_SUBSCRIBE_PREFIX}select`) {
      const tierId = interaction.values[0];
      const { getTier } = require('../game/premium-tiers');
      const tier = getTier(tierId);

      if (!tier) {
        await interaction.reply({
          content: '❌ 유효하지 않은 플랜입니다.',
          ephemeral: true,
        });
        return true;
      }

      await interaction.update({
        embeds: [createTierConfirmEmbed(tier)],
        components: [createPaymentButtons(tierId)],
      });

      return true;
    }

    return false;
  },

  async handleButton(interaction, { prisma }) {
    if (!interaction.customId.startsWith(PREMIUM_SUBSCRIBE_PREFIX)) {
      return false;
    }

    // 취소
    if (interaction.customId === `${PREMIUM_SUBSCRIBE_PREFIX}cancel`) {
      await interaction.update({
        embeds: [createTierSelectionEmbed()],
        components: [
          new ActionRowBuilder().addComponents(createTierSelectMenu())
        ],
      });
      return true;
    }

    // 결제 확인
    if (interaction.customId.startsWith(`${PREMIUM_SUBSCRIBE_PREFIX}confirm:`)) {
      const tierId = interaction.customId.split(':')[2];
      
      // Stripe Checkout 세션 생성
      try {
        const checkoutUrl = await createCheckoutSession(interaction.user.id, tierId);
        
        await interaction.reply({
          content: `💳 결제 페이지로 이동합니다:\n${checkoutUrl}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('[PREMIUM] Checkout session error:', error);
        await interaction.reply({
          content: '❌ 결제 페이지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
          ephemeral: true,
        });
      }

      return true;
    }

    return false;
  },

  PREMIUM_SUBSCRIBE_PREFIX,
};
