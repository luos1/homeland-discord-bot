const {
  mapNpcShopSalesToResourceDemand,
  getNpcShopResourceDemandMap24h,
  getResourceMarketStats24h,
  buildResourcePriceSnapshotRows,
} = require('../../src/game/dynamic-pricing');
const { createPrismaMock } = require('../helpers/prisma');

describe('dynamic pricing', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('NPC 상점 판매 로그를 자원 수요로 환산한다', () => {
    const demandMap = mapNpcShopSalesToResourceDemand([
      { itemKey: 'health_potion', quantity: 2 },
      { itemKey: 'mana_potion', quantity: 1 },
      { itemKey: 'invalid_item', quantity: 10 },
    ]);

    expect(demandMap.herb).toBe(9);
    expect(demandMap.invalid_item).toBeUndefined();
  });

  test('최근 24시간 NPC 상점 판매를 집계해 자원 수요 맵을 생성한다', async () => {
    prisma.npcShopSale.findMany.mockResolvedValue([
      { itemKey: 'health_potion', quantity: 3 },
      { itemKey: 'mana_potion', quantity: 2 },
    ]);

    const demandMap = await getNpcShopResourceDemandMap24h(prisma, new Date('2026-02-23T00:00:00.000Z'));

    expect(prisma.npcShopSale.findMany).toHaveBeenCalledTimes(1);
    expect(demandMap.herb).toBe(15);
  });

  test('시장 통계 계산 시 NPC 상점 수요를 demand24h에 반영한다', async () => {
    prisma.orderBook.aggregate
      .mockResolvedValueOnce({
        _sum: {
          quantity: 5,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          quantity: 7,
        },
      });
    prisma.tradeHistory.findMany.mockResolvedValue([]);

    const stats = await getResourceMarketStats24h(
      prisma,
      'herb',
      new Date('2026-02-23T00:00:00.000Z'),
      { npcShopDemandMap: { herb: 12 } },
    );

    expect(stats.supply24h).toBe(5);
    expect(stats.demand24h).toBe(19);
    expect(stats.npcShopDemand24h).toBe(12);
  });

  test('자원 가격 스냅샷 row 생성 시 NPC 매입가를 ItemPriceHistory 형태로 변환한다', () => {
    const now = new Date('2026-02-23T00:00:00.000Z');
    const rows = buildResourcePriceSnapshotRows(
      [
        {
          itemKey: 'wood',
          npcBuyPrice: 70,
        },
      ],
      now,
    );

    expect(rows).toEqual([
      {
        itemType: 'resource',
        itemKey: 'wood',
        avgPrice: 70,
        minPrice: 70,
        maxPrice: 70,
        volume: 0,
        recordedAt: now,
      },
    ]);
  });
});
