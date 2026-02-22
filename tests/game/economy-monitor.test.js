const {
  SNAPSHOT_TYPES,
  createEconomySnapshot,
  getEconomyStatistics,
  runEconomyAlertChecks,
} = require('../../src/game/economy-monitor');
const { createPrismaMock } = require('../helpers/prisma');

describe('economy monitor', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('스냅샷 생성: EconomySnapshot에 총 골드/자원/가격 집계를 저장한다', async () => {
    const now = new Date('2026-02-22T03:00:00.000Z');

    prisma.character.aggregate.mockResolvedValue({
      _sum: {
        gold: 15000,
      },
    });
    prisma.tradeHistory.aggregate.mockResolvedValue({
      _sum: {
        price: 42000,
      },
    });
    prisma.resource.groupBy.mockResolvedValue([
      {
        type: 'wood',
        _sum: {
          quantity: 120,
        },
      },
      {
        type: 'iron_ore',
        _sum: {
          quantity: 75,
        },
      },
    ]);
    prisma.tradeHistory.groupBy.mockResolvedValue([
      {
        itemKey: 'wood',
        _sum: {
          quantity: 30,
          price: 3000,
        },
        _count: {
          _all: 3,
        },
      },
      {
        itemKey: 'iron_ore',
        _sum: {
          quantity: 10,
          price: 2500,
        },
        _count: {
          _all: 2,
        },
      },
    ]);
    prisma.economySnapshot.create.mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
    }));
    prisma.resourcePriceHistory.createMany.mockResolvedValue({
      count: 2,
    });

    const snapshot = await createEconomySnapshot(prisma, {
      snapshotType: SNAPSHOT_TYPES.hourly,
      timestamp: now,
    });

    expect(snapshot.id).toBe(101);
    expect(snapshot.totalGold).toBe(15000);
    expect(snapshot.totalTradeVolume).toBe(42000);
    expect(snapshot.resources.wood.quantity).toBe(120);
    expect(snapshot.averagePrices.wood.averagePrice).toBe(100);
    expect(prisma.economySnapshot.create).toHaveBeenCalledTimes(1);
    expect(prisma.resourcePriceHistory.createMany).toHaveBeenCalledTimes(1);
  });

  test('통계 조회: 거래량 top10/부자 순위/거래 활성도를 반환한다', async () => {
    const now = new Date('2026-02-22T03:00:00.000Z');

    prisma.character.findMany
      .mockResolvedValueOnce([
        { id: 1, name: '거래왕', tradeVolume: 50000, gold: 12000 },
        { id: 2, name: '장터러', tradeVolume: 42000, gold: 8000 },
      ])
      .mockResolvedValueOnce([
        { id: 3, name: '부자왕', gold: 90000, tradeVolume: 15000 },
        { id: 1, name: '거래왕', gold: 12000, tradeVolume: 50000 },
      ]);
    prisma.tradeHistory.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-02-20T10:00:00.000Z'),
        price: 1000,
      },
      {
        createdAt: new Date('2026-02-20T14:00:00.000Z'),
        price: 2000,
      },
      {
        createdAt: new Date('2026-02-21T11:00:00.000Z'),
        price: 3000,
      },
    ]);

    const stats = await getEconomyStatistics(prisma, {
      limit: 10,
      activityDays: 7,
      now,
    });

    expect(stats.tradeVolumeTop10).toHaveLength(2);
    expect(stats.tradeVolumeTop10[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        name: '거래왕',
        tradeVolume: 50000,
      }),
    );

    expect(stats.richestRanking).toHaveLength(2);
    expect(stats.richestRanking[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        name: '부자왕',
        gold: 90000,
      }),
    );

    expect(stats.tradeActivity.totalTrades).toBe(3);
    expect(stats.tradeActivity.totalVolume).toBe(6000);
    expect(stats.tradeActivity.daily).toHaveLength(2);
  });

  test('알림 발동: 인플레이션 및 비정상 거래를 감지하고 저장한다', async () => {
    const now = new Date('2026-02-22T03:00:00.000Z');

    prisma.economySnapshot.findMany.mockResolvedValue([
      {
        id: 201,
        snapshotType: SNAPSHOT_TYPES.hourly,
        totalGold: 12000,
        averagePrices: {
          wood: {
            resourceType: 'wood',
            resourceName: '목재',
            averagePrice: 140,
          },
        },
      },
      {
        id: 200,
        snapshotType: SNAPSHOT_TYPES.hourly,
        totalGold: 9000,
        averagePrices: {
          wood: {
            resourceType: 'wood',
            resourceName: '목재',
            averagePrice: 100,
          },
        },
      },
    ]);
    prisma.tradeHistory.findMany.mockResolvedValue([
      {
        id: 777,
        sellerId: 11,
        buyerId: 22,
        itemType: 'resource',
        itemKey: 'wood',
        itemName: '목재',
        quantity: 10,
        price: 9000,
        createdAt: new Date('2026-02-22T02:50:00.000Z'),
      },
    ]);
    prisma.tradeHistory.groupBy.mockResolvedValue([
      {
        itemKey: 'wood',
        _sum: {
          quantity: 100,
          price: 10000,
        },
        _count: {
          _all: 20,
        },
      },
    ]);
    prisma.economyAlert.createMany.mockResolvedValue({
      count: 3,
    });

    const result = await runEconomyAlertChecks(prisma, {
      now,
      snapshotType: SNAPSHOT_TYPES.hourly,
      persist: true,
    });

    expect(result.inflationAlerts.length).toBeGreaterThan(0);
    expect(result.abnormalTradeAlerts.length).toBeGreaterThan(0);
    expect(result.alerts.length).toBe(result.inflationAlerts.length + result.abnormalTradeAlerts.length);
    expect(prisma.economyAlert.createMany).toHaveBeenCalledTimes(1);
  });
});
