const { settleExpiredAuctions } = require('./auction-house');

const DEFAULT_AUCTION_SETTLEMENT_INTERVAL_MS = 60 * 1000;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveAuctionSettlementConfig() {
  const intervalSeconds = toPositiveInt(
    process.env.AUCTION_SETTLEMENT_INTERVAL_SECONDS,
    60,
  );

  return {
    settlementIntervalMs: intervalSeconds * 1000,
  };
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

function startAuctionSettlementJob(
  prisma,
  {
    runOnStart = true,
    settlementIntervalMs = DEFAULT_AUCTION_SETTLEMENT_INTERVAL_MS,
  } = {},
) {
  let stopped = false;
  const timers = [];

  async function runSettlement() {
    if (stopped) {
      return null;
    }

    const summary = await settleExpiredAuctions(prisma, {
      now: new Date(),
      limit: 30,
    });

    if (summary.checked > 0) {
      console.log(
        `[Auction] checked=${summary.checked}, completed=${summary.completed}, `
        + `cancelled=${summary.cancelled}, failed=${summary.failed}`,
      );
    }

    return summary;
  }

  async function runSafely(label, fn) {
    try {
      await fn();
    } catch (error) {
      console.error(`[Auction] ${label} 실패:`, error);
    }
  }

  if (runOnStart) {
    void runSafely('초기 경매 정산', runSettlement);
  }

  schedule(timers, () => runSafely('경매 자동 정산', runSettlement), settlementIntervalMs);

  return {
    runSettlement,
    stop() {
      stopped = true;
      timers.forEach((timer) => clearInterval(timer));
      timers.length = 0;
    },
  };
}

module.exports = {
  DEFAULT_AUCTION_SETTLEMENT_INTERVAL_MS,
  resolveAuctionSettlementConfig,
  startAuctionSettlementJob,
};
