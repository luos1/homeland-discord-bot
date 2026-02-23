jest.mock('../../src/game/economy-monitor', () => ({
  SNAPSHOT_TYPES: {
    hourly: 'hourly',
    daily: 'daily',
    manual: 'manual',
  },
  createEconomySnapshot: jest.fn(),
  formatEconomyAlertLines: jest.fn(() => ['alert line']),
  runEconomyAlertChecks: jest.fn(),
}));

jest.mock('../../src/game/dynamic-pricing', () => ({
  refreshAllResourceDynamicPrices: jest.fn(),
  createResourcePriceSnapshots: jest.fn(),
}));

const { startEconomyMonitoringJob } = require('../../src/game/economy-scheduler');
const {
  createEconomySnapshot,
  runEconomyAlertChecks,
} = require('../../src/game/economy-monitor');
const {
  refreshAllResourceDynamicPrices,
  createResourcePriceSnapshots,
} = require('../../src/game/dynamic-pricing');

describe('economy scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createEconomySnapshot.mockResolvedValue({ id: 1 });
    runEconomyAlertChecks.mockResolvedValue({ alerts: [] });
    refreshAllResourceDynamicPrices.mockResolvedValue([]);
    createResourcePriceSnapshots.mockResolvedValue([]);
  });

  test('runResourcePriceSnapshot가 자원 가격 스냅샷 저장 함수를 호출한다', async () => {
    const prisma = {};
    const job = startEconomyMonitoringJob(prisma, {
      runOnStart: false,
      hourlySnapshotIntervalMs: 60 * 60 * 1000,
      dailySnapshotIntervalMs: 24 * 60 * 60 * 1000,
      alertCheckIntervalMs: 10 * 60 * 1000,
      dynamicPriceRefreshIntervalMs: 10 * 60 * 1000,
    });

    await job.runResourcePriceSnapshot();

    expect(createResourcePriceSnapshots).toHaveBeenCalledTimes(1);
    expect(createResourcePriceSnapshots).toHaveBeenCalledWith(prisma, expect.any(Date));
    job.stop();
  });
});
