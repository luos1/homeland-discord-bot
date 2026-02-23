const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const { RESOURCES } = require('../game/production-classes');
const { PRICE_ALERT_TYPES } = require('../game/price-alerts');
const { EMBED_COLORS, createDivider } = require('../utils/ui');

const MAX_ALERTS_PER_USER = 20;

function formatGold(value) {
  return `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')}G`;
}

function getResourceInfo(itemKey) {
  const resource = RESOURCES[itemKey];
  if (!resource) {
    return {
      key: itemKey,
      name: itemKey,
      emoji: '📦',
      tier: 0,
    };
  }

  return {
    key: itemKey,
    name: resource.name,
    emoji: resource.emoji,
    tier: resource.tier || 0,
  };
}

function formatAlertTypeLabel(alertType) {
  if (alertType === PRICE_ALERT_TYPES.priceDrop) {
    return '📉 가격 하락';
  }

  if (alertType === PRICE_ALERT_TYPES.priceRise) {
    return '📈 가격 상승';
  }

  return '🔔 가격 알림';
}

function formatAlertCondition(alertType, targetPrice) {
  if (alertType === PRICE_ALERT_TYPES.priceDrop) {
    return `${formatGold(targetPrice)} 이하`;
  }

  if (alertType === PRICE_ALERT_TYPES.priceRise) {
    return `${formatGold(targetPrice)} 이상`;
  }

  return formatGold(targetPrice);
}

function formatLastTriggered(lastTriggered) {
  if (!lastTriggered) {
    return '없음';
  }

  const date = new Date(lastTriggered);
  if (Number.isNaN(date.getTime())) {
    return '없음';
  }

  return date.toLocaleString('ko-KR');
}

function buildResourceChoices() {
  return Object.entries(RESOURCES)
    .map(([itemKey, resource]) => ({
      name: `${resource.emoji} ${resource.name}`,
      value: itemKey,
      tier: resource.tier || 0,
    }))
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, 'ko-KR'))
    .slice(0, 25)
    .map(({ name, value }) => ({ name, value }));
}

function createAlertListEmbed(alerts) {
  const lines = alerts.map((alert) => {
    const resource = getResourceInfo(alert.itemKey);
    const status = alert.isActive ? 'ON' : 'OFF';
    const condition = formatAlertCondition(alert.alertType, alert.targetPrice);

    return [
      `#${alert.id} [${status}] ${formatAlertTypeLabel(alert.alertType)}`,
      `   ${resource.emoji} ${resource.name} · 목표 ${condition}`,
      `   마지막 알림: ${formatLastTriggered(alert.lastTriggered)}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle('🔔 내 가격 알림 목록')
    .setDescription(
      [
        createDivider(),
        `등록: ${alerts.length}개`,
        '',
        lines.length > 0 ? lines.join('\n\n') : '등록된 알림이 없습니다.',
        '',
        createDivider(),
        '관리: `/alert off`, `/alert on`, `/alert clear`',
      ].join('\n'),
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alert')
    .setDescription('거래소 가격 알림을 설정합니다')
    .addSubcommand((sub) => sub
      .setName('set')
      .setDescription('가격 알림을 생성합니다')
      .addStringOption((option) => option
        .setName('item')
        .setDescription('알림을 받을 자원')
        .setRequired(true)
        .addChoices(...buildResourceChoices()))
      .addStringOption((option) => option
        .setName('type')
        .setDescription('알림 종류')
        .setRequired(true)
        .addChoices(
          { name: '📉 가격 하락', value: PRICE_ALERT_TYPES.priceDrop },
          { name: '📈 가격 상승', value: PRICE_ALERT_TYPES.priceRise },
        ))
      .addIntegerOption((option) => option
        .setName('price')
        .setDescription('목표 가격 (골드)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100000000)))
    .addSubcommand((sub) => sub
      .setName('list')
      .setDescription('내 알림 목록을 확인합니다')
      .addBooleanOption((option) => option
        .setName('active_only')
        .setDescription('활성 알림만 보기 (기본: 전체)')))
    .addSubcommand((sub) => sub
      .setName('off')
      .setDescription('알림을 비활성화합니다')
      .addIntegerOption((option) => option
        .setName('id')
        .setDescription('비활성화할 알림 ID')
        .setRequired(true)
        .setMinValue(1)))
    .addSubcommand((sub) => sub
      .setName('on')
      .setDescription('알림을 활성화합니다')
      .addIntegerOption((option) => option
        .setName('id')
        .setDescription('활성화할 알림 ID')
        .setRequired(true)
        .setMinValue(1)))
    .addSubcommand((sub) => sub
      .setName('clear')
      .setDescription('활성 알림을 모두 비활성화합니다')),

  async execute(interaction, { prisma }) {
    const character = await prisma.character.findUnique({
      where: {
        userId: interaction.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!character) {
      await interaction.reply({
        content: '캐릭터가 없습니다. 먼저 `/create`를 사용해주세요.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const itemKey = interaction.options.getString('item', true);
      const alertType = interaction.options.getString('type', true);
      const targetPrice = interaction.options.getInteger('price', true);
      const resource = getResourceInfo(itemKey);

      if (!RESOURCES[itemKey]) {
        await interaction.reply({
          content: '❌ 유효하지 않은 자원입니다.',
          ephemeral: true,
        });
        return;
      }

      const activeCount = await prisma.priceAlert.count({
        where: {
          userId: interaction.user.id,
          itemType: 'resource',
          isActive: true,
        },
      });

      if (activeCount >= MAX_ALERTS_PER_USER) {
        await interaction.reply({
          content: `❌ 활성 알림은 최대 ${MAX_ALERTS_PER_USER}개까지 설정할 수 있습니다.`,
          ephemeral: true,
        });
        return;
      }

      const duplicated = await prisma.priceAlert.findFirst({
        where: {
          userId: interaction.user.id,
          itemType: 'resource',
          itemKey,
          alertType,
          targetPrice,
          isActive: true,
        },
      });

      if (duplicated) {
        await interaction.reply({
          content: `ℹ️ 동일한 알림이 이미 활성화되어 있습니다. (ID: #${duplicated.id})`,
          ephemeral: true,
        });
        return;
      }

      const created = await prisma.priceAlert.create({
        data: {
          userId: interaction.user.id,
          characterId: character.id,
          itemType: 'resource',
          itemKey,
          alertType,
          targetPrice,
          isActive: true,
        },
      });

      await interaction.reply({
        content: [
          '✅ 가격 알림을 등록했습니다.',
          `알림 ID: #${created.id}`,
          `${formatAlertTypeLabel(alertType)} · ${resource.emoji} ${resource.name}`,
          `목표가: ${formatAlertCondition(alertType, targetPrice)}`,
          '',
          '알림은 Discord DM으로 발송됩니다.',
        ].join('\n'),
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'list') {
      const activeOnly = interaction.options.getBoolean('active_only') || false;

      const alerts = await prisma.priceAlert.findMany({
        where: {
          userId: interaction.user.id,
          itemType: 'resource',
          ...(activeOnly ? { isActive: true } : {}),
        },
        orderBy: [
          { isActive: 'desc' },
          { createdAt: 'desc' },
        ],
        take: MAX_ALERTS_PER_USER,
      });

      await interaction.reply({
        embeds: [createAlertListEmbed(alerts)],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'off') {
      const id = interaction.options.getInteger('id', true);

      const result = await prisma.priceAlert.updateMany({
        where: {
          id,
          userId: interaction.user.id,
          itemType: 'resource',
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      if (result.count === 0) {
        await interaction.reply({
          content: '❌ 비활성화할 알림을 찾지 못했습니다.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `✅ 알림 #${id} 를 비활성화했습니다.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'on') {
      const id = interaction.options.getInteger('id', true);

      const result = await prisma.priceAlert.updateMany({
        where: {
          id,
          userId: interaction.user.id,
          itemType: 'resource',
        },
        data: {
          isActive: true,
        },
      });

      if (result.count === 0) {
        await interaction.reply({
          content: '❌ 활성화할 알림을 찾지 못했습니다.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `✅ 알림 #${id} 를 활성화했습니다.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'clear') {
      const result = await prisma.priceAlert.updateMany({
        where: {
          userId: interaction.user.id,
          itemType: 'resource',
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      await interaction.reply({
        content: `✅ 활성 알림 ${result.count}개를 비활성화했습니다.`,
        ephemeral: true,
      });
    }
  },
};
