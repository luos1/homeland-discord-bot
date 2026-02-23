const { createPrismaMock } = require('../helpers/prisma');
const { getResourcePriceRecommendation } = require('../../src/game/price-recommendation');

describe('price recommendation', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('급등 구간: 24h 평균이 7일 평균보다 20% 이상 높으면 상향 추천가를 반환한다', async () => {
    prisma.tradeHistory.aggregate
      .mockResolvedValueOnce({
        _sum: {
          price: 70000,
          quantity: 100,
        },
        _count: {
          _all: 20,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          price: 24000,
          quantity: 24,
        },
        _count: {
          _all: 8,
        },
      });
    prisma.tradeHistory.findMany.mockResolvedValue([
      { quantity: 2, price: 1800 },
      { quantity: 1, price: 1000 },
      { quantity: 3, price: 2700 },
    ]);

    const recommendation = await getResourcePriceRecommendation(prisma, 'wood', {
      now: new Date('2026-02-23T00:00:00.000Z'),
    });

    expect(recommendation.recommendedPrice).toBe(1100);
    expect(recommendation.strategy).toBe('surge');
    expect(recommendation.trendDirection).toBe('up');
    expect(recommendation.confidence).toBeGreaterThanOrEqual(20);
  });

  test('거래 데이터 없음: 기본가 기반 fallback 추천을 반환한다', async () => {
    prisma.tradeHistory.aggregate
      .mockResolvedValueOnce({
        _sum: {
          price: 0,
          quantity: 0,
        },
        _count: {
          _all: 0,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          price: 0,
          quantity: 0,
        },
        _count: {
          _all: 0,
        },
      });
    prisma.tradeHistory.findMany.mockResolvedValue([]);

    const recommendation = await getResourcePriceRecommendation(prisma, 'wood', {
      now: new Date('2026-02-23T00:00:00.000Z'),
    });

    expect(recommendation.basePrice).toBe(24);
    expect(recommendation.recommendedPrice).toBe(24);
    expect(recommendation.strategy).toBe('fallback_base');
    expect(recommendation.confidence).toBe(20);
  });
});
