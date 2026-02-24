const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllTiers } = require('../game/premium-tiers');
const { createCheckoutSession, getSubscription, cancelSubscription } = require('../game/payment-stripe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('프리미엄 구독')
    .setDescriptionLocalizations({ ko: '프리미엄 구독' })
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('구독 정보 확인')
        .setDescriptionLocalizations({ ko: '구독 정보 확인' })
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('내 구독 상태')
        .setDescriptionLocalizations({ ko: '내 구독 상태' })
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('구독 취소')
        .setDescriptionLocalizations({ ko: '구독 취소' })
    ),

  async execute(interaction, { prisma }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      return await showSubscribeInfo(interaction);
    }

    if (subcommand === 'status') {
      return await showStatus(interaction, { prisma });
    }

    if (subcommand === 'cancel') {
      return await handleCancel(interaction, { prisma });
    }
  }
};

async function showSubscribeInfo(interaction) {
  const tiers = getAllTiers();

  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('💎 프리미엄 구독')
    .setDescription([
      '더 빠른 성장과 특별한 혜택을 누리세요!',
      '',
      '**구독 혜택:**'
    ].join('\n'));

  tiers.forEach(tier => {
    embed.addFields({
      name: `${tier.emoji} ${tier.name} - $${tier.price}/월`,
      value: tier.description.join('\n'),
      inline: false
    });
  });

  embed.addFields({
    name: '📅 연간 구독',
    value: '연간 구독 시 20% 할인! (2개월 무료)',
    inline: false
  });

  const buttons = [
    new ButtonBuilder()
      .setCustomId('subscribe_bronze_monthly')
      .setLabel('🥉 브론즈 ($5/월)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('subscribe_silver_monthly')
      .setLabel('🥈 실버 ($10/월)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('subscribe_gold_monthly')
      .setLabel('🥇 골드 ($20/월)')
      .setStyle(ButtonStyle.Success)
  ];

  const row = new ActionRowBuilder().addComponents(buttons);

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function showStatus(interaction, { prisma }) {
  const subscription = await getSubscription(interaction.user.id, prisma);

  if (!subscription || subscription.status !== 'active') {
    const embed = new EmbedBuilder()
      .setColor(0x95A5A6)
      .setTitle('구독 정보')
      .setDescription('현재 활성 구독이 없습니다.');

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const tier = subscription.tier;
  const emoji = tier === 'bronze' ? '🥉' : tier === 'silver' ? '🥈' : '🥇';
  const name = tier === 'bronze' ? '브론즈' : tier === 'silver' ? '실버' : '골드';

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('💎 활성 구독')
    .setDescription([
      `${emoji} **${name}** 멤버십`,
      '',
      `📅 시작일: ${subscription.currentPeriodStart?.toLocaleDateString('ko-KR')}`,
      `📆 갱신일: ${subscription.currentPeriodEnd?.toLocaleDateString('ko-KR')}`,
      '',
      '감사합니다! 🙏'
    ].join('\n'));

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('subscribe_cancel_confirm')
        .setLabel('구독 취소')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleCancel(interaction, { prisma }) {
  const result = await cancelSubscription(interaction.user.id, prisma);

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x95A5A6)
    .setTitle('구독 취소됨')
    .setDescription([
      '프리미엄 구독이 취소되었습니다.',
      '',
      '현재 결제 기간이 끝날 때까지는 혜택을 계속 이용할 수 있습니다.',
      '',
      '다시 구독하실 때는 `/subscribe info`를 사용하세요.'
    ].join('\n'));

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSubscribeButton(interaction, { prisma }) {
  if (!interaction.customId.startsWith('subscribe_')) return false;

  const parts = interaction.customId.split('_');
  
  if (parts[1] === 'cancel' && parts[2] === 'confirm') {
    const result = await cancelSubscription(interaction.user.id, prisma);
    
    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      return true;
    }
    
    await interaction.update({ 
      content: '✅ 구독이 취소되었습니다. 현재 결제 기간까지 혜택을 이용할 수 있습니다.', 
      embeds: [], 
      components: [] 
    });
    return true;
  }

  const tier = parts[1]; // bronze, silver, gold
  const period = parts[2]; // monthly, yearly

  const result = await createCheckoutSession(interaction.user.id, tier, period, {
    email: interaction.user.tag
  });

  if (!result.success) {
    await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('💳 결제 진행')
    .setDescription([
      '아래 링크를 클릭하여 결제를 완료하세요.',
      '',
      '**안전한 결제:**',
      '• Stripe를 통한 보안 결제',
      '• 카드 정보는 저장되지 않습니다',
      '• 언제든지 취소 가능',
      '',
      `[결제하기](${result.url})`
    ].join('\n'));

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

module.exports.handleSubscribeButton = handleSubscribeButton;
