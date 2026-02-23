const { RESOURCES } = require('./production-classes');
const { getResourceBasePrice } = require('./economy');

const PRICE_ALERT_TYPES = {
  priceDrop: 'price_drop',
  priceRise: 'price_rise',
};

const ALERT_LABELS = {
  [PRICE_ALERT_TYPES.priceDrop]: {
    emoji: '📉',
    title: '가격 하락',
  },
  [PRICE_ALERT_TYPES.priceRise]: {
    emoji: '📈',
    title: '가격 상승',
  },
};

const DEFAULT_PRICE_ALERT_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_ALERT_COOLDOWN_MS = 60 * 60 * 1000;
const DEFAULT_LOOKBACK_HOURS = 24;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatGold(value) {
  return `${Math.max(0, Math.round(toSafeNumber(value, 0))).toLocaleString('ko-KR')}G`;
}

function toResourceName(itemKey) {
  return RESOURCES[itemKey]?.name || itemKey;
}

function toResourceEmoji(itemKey) {
  return RESOURCES[itemKey]?.emoji || '📦';
}

function resolvePriceAlertConfig() {
  return {
    checkIntervalMs: toPositiveInt(
      process.env.PRICE_ALERT_CHECK_INTERVAL_MINUTES,
      10,
    ) * 60 * 1000,
    cooldownMs: toPositiveInt(
      process.env.PRICE_ALERT_RETRIGGER_COOLDOWN_MINUTES,
      60,
    ) * 60 * 1000,
  };
}

function shouldTriggerAlert(alert, currentPrice) {
  if (!alert || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return false;
  }

  const targetPrice = toSafeNumber(alert.targetPrice, 0);
  if (targetPrice <= 0) {
    return false;
  }

  if (alert.alertType === PRICE_ALERT_TYPES.priceDrop) {
    return currentPrice <= targetPrice;
  }

  if (alert.alertType === PRICE_ALERT_TYPES.priceRise) {
    return currentPrice >= targetPrice;
  }

  return false;
}

function isCooldownActive(alert, now, cooldownMs) {
  if (!alert?.lastTriggered) {
    return false;
  }

  const lastTriggeredAt = new Date(alert.lastTriggered).getTime();
  if (!Number.isFinite(lastTriggeredAt)) {
    return false;
  }

  return now.getTime() - lastTriggeredAt < cooldownMs;
}

async function getCurrentResourceUnitPrice(
  prisma,
  itemKey,
  {
    now = new Date(),
    lookbackHours = DEFAULT_LOOKBACK_HOURS,
  } = {},
) {
  const lookbackMs = toPositiveInt(lookbackHours, DEFAULT_LOOKBACK_HOURS) * 60 * 60 * 1000;
  const start = new Date(now.getTime() - lookbackMs);

  const aggregate = await prisma.tradeHistory.aggregate({
    where: {
      itemType: 'resource',
      itemKey,
      createdAt: {
        gte: start,
        lte: now,
      },
    },
    _sum: {
      price: true,
      quantity: true,
    },
  });

  const sumPrice = toSafeNumber(aggregate?._sum?.price, 0);
  const sumQuantity = toSafeNumber(aggregate?._sum?.quantity, 0);

  if (sumQuantity > 0 && sumPrice > 0) {
    return Math.max(1, Math.round(sumPrice / sumQuantity));
  }

  const latestTrade = await prisma.tradeHistory.findFirst({
    where: {
      itemType: 'resource',
      itemKey,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      price: true,
      quantity: true,
    },
  });

  const latestTotalPrice = toSafeNumber(latestTrade?.price, 0);
  const latestQuantity = toSafeNumber(latestTrade?.quantity, 0);

  if (latestQuantity > 0 && latestTotalPrice > 0) {
    return Math.max(1, Math.round(latestTotalPrice / latestQuantity));
  }

  return getResourceBasePrice(itemKey);
}

function buildAlertMessage(trigger) {
  const { alert, currentPrice } = trigger;
  const meta = ALERT_LABELS[alert.alertType] || { emoji: '🔔', title: '가격 알림' };
  const resourceName = toResourceName(alert.itemKey);
  const resourceEmoji = toResourceEmoji(alert.itemKey);
  const target = toSafeNumber(alert.targetPrice, 0);
  const condition = alert.alertType === PRICE_ALERT_TYPES.priceDrop
    ? `${formatGold(target)} 이하`
    : `${formatGold(target)} 이상`;

  return [
    `🔔 ${meta.title} 알림`,
    '',
    `${resourceEmoji} **${resourceName}**`,
    `현재가: **${formatGold(currentPrice)}**`,
    `목표가: **${condition}**`,
    '',
    `알림 ID: #${alert.id}`,
    '관리: `/alert off id:<알림ID>`',
  ].join('\n');
}

async function sendPriceAlertDm(client, trigger) {
  if (!client || !trigger?.alert?.userId) {
    return {
      sent: false,
      reason: 'CLIENT_UNAVAILABLE',
    };
  }

  try {
    const user = await client.users.fetch(trigger.alert.userId);

    if (!user) {
      return {
        sent: false,
        reason: 'USER_NOT_FOUND',
      };
    }

    await user.send({
      content: buildAlertMessage(trigger),
    });

    return {
      sent: true,
      reason: null,
    };
  } catch (error) {
    return {
      sent: false,
      reason: error?.code ? `DISCORD_${error.code}` : 'DM_SEND_FAILED',
      error,
    };
  }
}

async function findTriggeredPriceAlerts(
  prisma,
  {
    now = new Date(),
    cooldownMs = DEFAULT_ALERT_COOLDOWN_MS,
  } = {},
) {
  const activeAlerts = await prisma.priceAlert.findMany({
    where: {
      isActive: true,
      itemType: 'resource',
      alertType: {
        in: [PRICE_ALERT_TYPES.priceDrop, PRICE_ALERT_TYPES.priceRise],
      },
    },
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  if (activeAlerts.length === 0) {
    return {
      activeAlerts,
      triggered: [],
      currentPrices: {},
    };
  }

  const uniqueItemKeys = [...new Set(activeAlerts.map((alert) => alert.itemKey))];
  const prices = await Promise.all(
    uniqueItemKeys.map(async (itemKey) => ({
      itemKey,
      unitPrice: await getCurrentResourceUnitPrice(prisma, itemKey, { now }),
    })),
  );

  const currentPrices = prices.reduce((acc, row) => {
    acc[row.itemKey] = row.unitPrice;
    return acc;
  }, {});

  const triggered = activeAlerts
    .filter((alert) => !isCooldownActive(alert, now, cooldownMs))
    .filter((alert) => shouldTriggerAlert(alert, currentPrices[alert.itemKey]))
    .map((alert) => ({
      alert,
      currentPrice: currentPrices[alert.itemKey],
    }));

  return {
    activeAlerts,
    triggered,
    currentPrices,
  };
}

async function runPriceAlertChecks(
  prisma,
  {
    client = null,
    now = new Date(),
    cooldownMs = DEFAULT_ALERT_COOLDOWN_MS,
  } = {},
) {
  const { activeAlerts, triggered } = await findTriggeredPriceAlerts(prisma, {
    now,
    cooldownMs,
  });

  if (triggered.length === 0) {
    return {
      checkedCount: activeAlerts.length,
      triggeredCount: 0,
      sentCount: 0,
      failedCount: 0,
      deliveries: [],
    };
  }

  const deliveries = await Promise.all(
    triggered.map(async (trigger) => ({
      ...trigger,
      delivery: await sendPriceAlertDm(client, trigger),
    })),
  );

  await Promise.all(
    deliveries.map(({ alert }) => (
      prisma.priceAlert.update({
        where: {
          id: alert.id,
        },
        data: {
          lastTriggered: now,
        },
      })
    )),
  );

  const sentCount = deliveries.filter((row) => row.delivery.sent).length;

  return {
    checkedCount: activeAlerts.length,
    triggeredCount: triggered.length,
    sentCount,
    failedCount: triggered.length - sentCount,
    deliveries,
  };
}

function startPriceAlertJob(
  prisma,
  {
    client = null,
    runOnStart = true,
    intervalMs = DEFAULT_PRICE_ALERT_CHECK_INTERVAL_MS,
    cooldownMs = DEFAULT_ALERT_COOLDOWN_MS,
  } = {},
) {
  const safeIntervalMs = toPositiveInt(intervalMs, DEFAULT_PRICE_ALERT_CHECK_INTERVAL_MS);
  const safeCooldownMs = toPositiveInt(cooldownMs, DEFAULT_ALERT_COOLDOWN_MS);
  let stopped = false;
  let isRunning = false;

  async function runCheck(trigger) {
    if (stopped) {
      return null;
    }

    if (isRunning) {
      console.warn(`[price-alerts] 이전 작업 실행 중 - 건너뜀 (${trigger})`);
      return null;
    }

    isRunning = true;

    try {
      const result = await runPriceAlertChecks(prisma, {
        client,
        now: new Date(),
        cooldownMs: safeCooldownMs,
      });

      if (result.triggeredCount > 0) {
        console.log(
          `[price-alerts] ${result.triggeredCount}건 감지, DM ${result.sentCount}건 전송 (${trigger})`,
        );
      }

      return result;
    } catch (error) {
      console.error(`[price-alerts] 알림 점검 실패 (${trigger}):`, error);
      return null;
    } finally {
      isRunning = false;
    }
  }

  const timer = setInterval(() => {
    void runCheck('interval');
  }, safeIntervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  if (runOnStart) {
    void runCheck('startup');
  }

  return {
    intervalMs: safeIntervalMs,
    cooldownMs: safeCooldownMs,
    runNow: (trigger = 'manual') => runCheck(trigger),
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

module.exports = {
  PRICE_ALERT_TYPES,
  DEFAULT_PRICE_ALERT_CHECK_INTERVAL_MS,
  DEFAULT_ALERT_COOLDOWN_MS,
  resolvePriceAlertConfig,
  shouldTriggerAlert,
  getCurrentResourceUnitPrice,
  findTriggeredPriceAlerts,
  runPriceAlertChecks,
  startPriceAlertJob,
  sendPriceAlertDm,
};
