const {
  SNAPSHOT_TYPES,
  createEconomySnapshot,
  formatEconomyAlertLines,
  runEconomyAlertChecks,
} = require('./economy-monitor');
const {
  refreshAllResourceDynamicPrices,
  createResourcePriceSnapshots,
} = require('./dynamic-pricing');

const DEFAULT_HOURLY_SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_DAILY_SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ALERT_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_DYNAMIC_PRICE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveEconomyMonitoringConfig() {
  return {
    hourlySnapshotIntervalMs: toPositiveInt(
      process.env.ECONOMY_HOURLY_SNAPSHOT_INTERVAL_MINUTES,
      60,
    ) * 60 * 1000,
    dailySnapshotIntervalMs: toPositiveInt(
      process.env.ECONOMY_DAILY_SNAPSHOT_INTERVAL_MINUTES,
      24 * 60,
    ) * 60 * 1000,
    alertCheckIntervalMs: toPositiveInt(
      process.env.ECONOMY_ALERT_CHECK_INTERVAL_MINUTES,
      10,
    ) * 60 * 1000,
    dynamicPriceRefreshIntervalMs: toPositiveInt(
      process.env.DYNAMIC_PRICE_REFRESH_INTERVAL_MINUTES,
      10,
    ) * 60 * 1000,
  };
}

async function notifyAdminAlertChannel(client, alerts) {
  const channelId = process.env.ECONOMY_ALERT_CHANNEL_ID;

  if (!client || !channelId || !alerts || alerts.length === 0) {
    return false;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      return false;
    }

    const lines = formatEconomyAlertLines(alerts, {
      maxLines: 8,
    });

    await channel.send({
      content: [
        '🚨 경제 이상 징후 감지',
        '',
        ...lines,
      ].join('\n'),
    });

    return true;
  } catch (error) {
    console.error('경제 알림 채널 전송 실패:', error);
    return false;
  }
}

function schedule(timers, fn, intervalMs) {
  const timer = setInterval(() => {
    void fn();
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  timers.push(timer);
}

function startEconomyMonitoringJob(
  prisma,
  {
    client = null,
    runOnStart = true,
    hourlySnapshotIntervalMs = DEFAULT_HOURLY_SNAPSHOT_INTERVAL_MS,
    dailySnapshotIntervalMs = DEFAULT_DAILY_SNAPSHOT_INTERVAL_MS,
    alertCheckIntervalMs = DEFAULT_ALERT_CHECK_INTERVAL_MS,
    dynamicPriceRefreshIntervalMs = DEFAULT_DYNAMIC_PRICE_REFRESH_INTERVAL_MS,
  } = {},
) {
  const timers = [];
  let stopped = false;

  async function runHourlySnapshot() {
    if (stopped) {
      return null;
    }

    const snapshot = await createEconomySnapshot(prisma, {
      snapshotType: SNAPSHOT_TYPES.hourly,
      timestamp: new Date(),
    });

    console.log(`[Economy] Hourly snapshot created #${snapshot.id}`);
    return snapshot;
  }

  async function runDailySnapshot() {
    if (stopped) {
      return null;
    }

    const snapshot = await createEconomySnapshot(prisma, {
      snapshotType: SNAPSHOT_TYPES.daily,
      timestamp: new Date(),
      priceLookbackHours: 24,
    });

    console.log(`[Economy] Daily snapshot created #${snapshot.id}`);
    return snapshot;
  }

  async function runAlertChecks() {
    if (stopped) {
      return null;
    }

    const result = await runEconomyAlertChecks(prisma, {
      snapshotType: SNAPSHOT_TYPES.hourly,
      persist: true,
    });

    if (result.alerts.length > 0) {
      const lines = formatEconomyAlertLines(result.alerts, {
        maxLines: 5,
      });
      console.warn('[Economy] Alerts detected:\n' + lines.join('\n'));
      await notifyAdminAlertChannel(client, result.alerts);
    }

    return result;
  }

  async function runDynamicPriceRefresh() {
    if (stopped) {
      return null;
    }

    const refreshed = await refreshAllResourceDynamicPrices(prisma, new Date());
    console.log(`[Economy] Dynamic prices refreshed (${refreshed.length} resources)`);
    return refreshed;
  }

  async function runResourcePriceSnapshot() {
    if (stopped) {
      return null;
    }

    const rows = await createResourcePriceSnapshots(prisma, new Date());
    console.log(`[Economy] Resource price snapshots saved (${rows.length} resources)`);
    return rows;
  }

  async function runSafely(label, fn) {
    try {
      await fn();
    } catch (error) {
      console.error(`[Economy] ${label} 실패:`, error);
    }
  }

  if (runOnStart) {
    void runSafely('초기 시간별 스냅샷', runHourlySnapshot);
    void runSafely('초기 알림 점검', runAlertChecks);
    void runSafely('초기 동적 가격 갱신', runDynamicPriceRefresh);
    void runSafely('초기 자원 가격 스냅샷', runResourcePriceSnapshot);
  }

  schedule(timers, () => runSafely('시간별 스냅샷', runHourlySnapshot), hourlySnapshotIntervalMs);
  schedule(timers, () => runSafely('일별 스냅샷', runDailySnapshot), dailySnapshotIntervalMs);
  schedule(timers, () => runSafely('알림 점검', runAlertChecks), alertCheckIntervalMs);
  schedule(
    timers,
    () => runSafely('자원 가격 스냅샷', runResourcePriceSnapshot),
    hourlySnapshotIntervalMs,
  );
  schedule(
    timers,
    () => runSafely('동적 가격 갱신', runDynamicPriceRefresh),
    dynamicPriceRefreshIntervalMs,
  );

  return {
    stop() {
      stopped = true;
      timers.forEach((timer) => clearInterval(timer));
      timers.length = 0;
    },
    runHourlySnapshot,
    runDailySnapshot,
    runAlertChecks,
    runResourcePriceSnapshot,
    runDynamicPriceRefresh,
  };
}

module.exports = {
  DEFAULT_HOURLY_SNAPSHOT_INTERVAL_MS,
  DEFAULT_DAILY_SNAPSHOT_INTERVAL_MS,
  DEFAULT_ALERT_CHECK_INTERVAL_MS,
  DEFAULT_DYNAMIC_PRICE_REFRESH_INTERVAL_MS,
  resolveEconomyMonitoringConfig,
  startEconomyMonitoringJob,
  notifyAdminAlertChannel,
};
