'use strict';

const {
  startSessionCleanupJob,
  DEFAULT_CLEANUP_INTERVAL_MS,
} = require('../game/session-cleanup');
const {
  startDailyQuestResetScheduler,
  stopDailyQuestResetScheduler,
} = require('../game/daily-quests');
const {
  resolveEconomyMonitoringConfig,
  startEconomyMonitoringJob,
} = require('../game/economy-scheduler');
const {
  resolveAuctionSettlementConfig,
  startAuctionSettlementJob,
} = require('../game/auction-scheduler');
const {
  resolvePriceAlertConfig,
  startPriceAlertJob,
} = require('../game/price-alerts');

let sessionCleanupJob = null;
let economyMonitoringJob = null;
let auctionSettlementJob = null;
let priceAlertJob = null;
let randomNpcInterval = null;

function resolveCleanupIntervalMs() {
  const rawMinutes = process.env.SESSION_CLEANUP_INTERVAL_MINUTES;

  if (!rawMinutes) {
    return DEFAULT_CLEANUP_INTERVAL_MS;
  }

  const parsed = Number.parseInt(rawMinutes, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `SESSION_CLEANUP_INTERVAL_MINUTES 값이 잘못되어 기본값(60분)을 사용합니다: ${rawMinutes}`,
    );
    return DEFAULT_CLEANUP_INTERVAL_MS;
  }

  return parsed * 60 * 1000;
}

function startAll(prisma, readyClient) {
  // 1시간 주기 자동 세션 정리 시작 (시작 시 즉시 1회 실행)
  try {
    if (sessionCleanupJob) {
      sessionCleanupJob.stop();
    }

    const intervalMs = resolveCleanupIntervalMs();
    sessionCleanupJob = startSessionCleanupJob(prisma, {
      intervalMs,
      runOnStart: true,
    });
    console.log(`🕒 자동 세션 정리 작업 시작 (${Math.floor(intervalMs / 60000)}분 주기)`);
  } catch (error) {
    console.error('자동 세션 정리 작업 시작 실패:', error);
  }

  try {
    startDailyQuestResetScheduler(prisma);
  } catch (error) {
    console.error('Daily quest 자정 리셋 스케줄러 시작 실패:', error);
  }

  try {
    if (economyMonitoringJob) {
      economyMonitoringJob.stop();
    }

    const economyConfig = resolveEconomyMonitoringConfig();
    economyMonitoringJob = startEconomyMonitoringJob(prisma, {
      client: readyClient,
      runOnStart: true,
      hourlySnapshotIntervalMs: economyConfig.hourlySnapshotIntervalMs,
      dailySnapshotIntervalMs: economyConfig.dailySnapshotIntervalMs,
      alertCheckIntervalMs: economyConfig.alertCheckIntervalMs,
      dynamicPriceRefreshIntervalMs: economyConfig.dynamicPriceRefreshIntervalMs,
    });

    console.log(
      `📈 경제 모니터링 시작 (hourly=${Math.floor(economyConfig.hourlySnapshotIntervalMs / 60000)}분, `
      + `daily=${Math.floor(economyConfig.dailySnapshotIntervalMs / 60000)}분, `
      + `alerts=${Math.floor(economyConfig.alertCheckIntervalMs / 60000)}분, `
      + `dynamic=${Math.floor(economyConfig.dynamicPriceRefreshIntervalMs / 60000)}분)`,
    );
  } catch (error) {
    console.error('경제 모니터링 시작 실패:', error);
  }

  try {
    if (auctionSettlementJob) {
      auctionSettlementJob.stop();
    }

    const auctionConfig = resolveAuctionSettlementConfig();
    auctionSettlementJob = startAuctionSettlementJob(prisma, {
      runOnStart: true,
      settlementIntervalMs: auctionConfig.settlementIntervalMs,
    });

    console.log(
      `🔨 경매 자동 정산 시작 (${Math.floor(auctionConfig.settlementIntervalMs / 1000)}초 주기)`,
    );
  } catch (error) {
    console.error('경매 자동 정산 시작 실패:', error);
  }

  try {
    if (priceAlertJob) {
      priceAlertJob.stop();
    }

    const alertConfig = resolvePriceAlertConfig();
    priceAlertJob = startPriceAlertJob(prisma, {
      client: readyClient,
      runOnStart: true,
      intervalMs: alertConfig.checkIntervalMs,
      cooldownMs: alertConfig.cooldownMs,
    });

    console.log(
      `🔔 가격 알림 스케줄러 시작 (interval=${Math.floor(alertConfig.checkIntervalMs / 60000)}분, `
      + `cooldown=${Math.floor(alertConfig.cooldownMs / 60000)}분)`,
    );
  } catch (error) {
    console.error('가격 알림 스케줄러 시작 실패:', error);
  }

  // 랜덤 NPC 스폰 스케줄러
  try {
    const { spawnRandomNpc } = require('../game/random-npc-handler');
    const { SPAWN_CONFIG } = require('../game/random-npcs');

    // 6-12시간마다 체크 (30% 확률로 스폰)
    const checkIntervalMs = 6 * 60 * 60 * 1000; // 6시간

    randomNpcInterval = setInterval(async () => {
      try {
        const shouldSpawn = Math.random() < SPAWN_CONFIG.spawnChance;
        if (shouldSpawn) {
          await spawnRandomNpc(prisma, readyClient);
          console.log('✨ 랜덤 NPC 스폰됨');
        }
      } catch (error) {
        console.error('랜덤 NPC 스폰 실패:', error);
      }
    }, checkIntervalMs);

    console.log(`✨ 랜덤 NPC 스폰 스케줄러 시작 (${checkIntervalMs / 3600000}시간마다 체크, ${SPAWN_CONFIG.spawnChance * 100}% 확률)`);
  } catch (error) {
    console.error('랜덤 NPC 스폰 스케줄러 시작 실패:', error);
  }
}

function stopAll() {
  stopDailyQuestResetScheduler();

  if (sessionCleanupJob) {
    sessionCleanupJob.stop();
    sessionCleanupJob = null;
  }

  if (economyMonitoringJob) {
    economyMonitoringJob.stop();
    economyMonitoringJob = null;
  }

  if (auctionSettlementJob) {
    auctionSettlementJob.stop();
    auctionSettlementJob = null;
  }

  if (priceAlertJob) {
    priceAlertJob.stop();
    priceAlertJob = null;
  }

  if (randomNpcInterval) {
    clearInterval(randomNpcInterval);
    randomNpcInterval = null;
  }
}

module.exports = {
  startAll,
  stopAll,
};
