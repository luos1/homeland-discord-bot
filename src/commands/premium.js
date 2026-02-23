const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const { EMBED_COLORS, createDivider, formatNumber } = require('../utils/ui');
const { buildVillageHomeCustomId } = require('../utils/village');
const {
  PREMIUM_PLAN,
  formatPremiumPrice,
  resolvePremiumBenefits,
} = require('../game/premium');

const PREMIUM_BUTTON_PREFIX = 'premium:';
const PREMIUM_TOGGLE_PREFIX = `${PREMIUM_BUTTON_PREFIX}toggle:`;
const PREMIUM_TOGGLE_FIELDS = new Set(['autoFight', 'autoPotion', 'autoConsumable']);

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

function formatToggleStatus(enabled) {
  return enabled ? 'ON' : 'OFF';
}

function getToggleState(subscription, key) {
  return Boolean(subscription?.[key]);
}

function parsePremiumToggleField(customId) {
  if (!customId || !customId.startsWith(PREMIUM_TOGGLE_PREFIX)) {
    return null;
  }

  const key = customId.slice(PREMIUM_TOGGLE_PREFIX.length);
  if (!PREMIUM_TOGGLE_FIELDS.has(key)) {
    return null;
  }

  return key;
}

function createStatusEmbed({ character, subscription, now = new Date() }) {
  const benefits = resolvePremiumBenefits(subscription, now);
  const autoFight = getToggleState(subscription, 'autoFight');
  const autoPotion = getToggleState(subscription, 'autoPotion');
  const autoConsumable = getToggleState(subscription, 'autoConsumable');

  const descriptionLines = [
    createDivider(),
    `🧑 캐릭터: ${character.name}`,
    `💰 보유 골드: ${formatNumber(character.gold)}G`,
    `💎 보유 젬: ${formatNumber(character.gems || 0)}`,
    '',
    `💳 플랜: ${PREMIUM_PLAN.label} (${formatPremiumPrice()}/월)`,
    `📌 상태: ${benefits.active ? '활성' : '비활성'}`,
  ];

  if (benefits.active && subscription?.endDate) {
    descriptionLines.push(`🗓️ 구독 종료일: ${formatDate(subscription.endDate)}`);
  }

  descriptionLines.push(
    '',
    '⚙️ 자동 전투 설정',
    `⚔️ 자동전투: ${formatToggleStatus(autoFight)}`,
    `💊 자동 물약: ${formatToggleStatus(autoPotion)}`,
    `✨ 자동 소비템: ${formatToggleStatus(autoConsumable)}`,
    '',
    benefits.active
      ? '아래 버튼으로 자동 전투 설정을 변경할 수 있습니다.'
      : 'Premium 활성화 후 자동 전투 기능을 사용할 수 있습니다.',
    '',
    createDivider(),
    `🎁 전투 경험치 +${Math.round((PREMIUM_PLAN.xpMultiplier - 1) * 100)}%`,
    `🎁 전투 골드 +${Math.round((PREMIUM_PLAN.goldMultiplier - 1) * 100)}%`,
    `🎁 일일 젬 +${PREMIUM_PLAN.dailyGemBonus}`,
  );

  return new EmbedBuilder()
    .setColor(benefits.active ? EMBED_COLORS.victory : EMBED_COLORS.profile)
    .setTitle('💎 Premium Pass')
    .setDescription(descriptionLines.join('\n'));
}

function createToggleButton({
  key,
  label,
  emoji,
  enabled,
  active,
}) {
  return new ButtonBuilder()
    .setCustomId(`${PREMIUM_TOGGLE_PREFIX}${key}`)
    .setLabel(`${label}: ${formatToggleStatus(enabled)}`)
    .setEmoji(emoji)
    .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(!active);
}

function createPremiumActionRow({ subscription, now = new Date() }) {
  const benefits = resolvePremiumBenefits(subscription, now);
  const active = benefits.active;

  return new ActionRowBuilder().addComponents(
    createToggleButton({
      key: 'autoFight',
      label: '자동전투',
      emoji: '⚔️',
      enabled: getToggleState(subscription, 'autoFight'),
      active,
    }),
    createToggleButton({
      key: 'autoPotion',
      label: '자동 물약',
      emoji: '💊',
      enabled: getToggleState(subscription, 'autoPotion'),
      active,
    }),
    createToggleButton({
      key: 'autoConsumable',
      label: '자동 소비템',
      emoji: '✨',
      enabled: getToggleState(subscription, 'autoConsumable'),
      active,
    }),
    new ButtonBuilder()
      .setCustomId(buildVillageHomeCustomId())
      .setLabel('마을로')
      .setEmoji('🏘️')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildPremiumPayload({ character, subscription, now = new Date() }) {
  return {
    embeds: [createStatusEmbed({ character, subscription, now })],
    components: [createPremiumActionRow({ subscription, now })],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Premium Pass 상태와 자동 전투 설정을 확인합니다'),

  async execute(interaction, { prisma }) {
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
    const subscription = await prisma.premiumSubscription.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });

    await interaction.reply({
      ...buildPremiumPayload({
        character,
        subscription,
        now,
      }),
      ephemeral: true,
    });
  },

  async handlePremiumButton(interaction, { prisma }) {
    const toggleField = parsePremiumToggleField(interaction.customId);
    if (!toggleField) {
      return false;
    }

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
      return true;
    }

    const now = new Date();
    const subscription = await prisma.premiumSubscription.findUnique({
      where: {
        userId: interaction.user.id,
      },
    });
    const benefits = resolvePremiumBenefits(subscription, now);

    if (!subscription || !benefits.active) {
      await interaction.reply({
        content: '활성 Premium Pass가 없습니다.',
        ephemeral: true,
      });
      return true;
    }

    const updatedSubscription = await prisma.premiumSubscription.update({
      where: {
        userId: interaction.user.id,
      },
      data: {
        [toggleField]: !Boolean(subscription[toggleField]),
      },
    });

    await interaction.update(buildPremiumPayload({
      character,
      subscription: updatedSubscription,
      now,
    }));

    return true;
  },

  PREMIUM_BUTTON_PREFIX,
};
