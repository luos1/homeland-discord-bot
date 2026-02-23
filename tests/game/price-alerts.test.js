const { createPrismaMock } = require('../helpers/prisma');
const {
  PRICE_ALERT_TYPES,
  shouldTriggerAlert,
  runPriceAlertChecks,
} = require('../../src/game/price-alerts');

describe('price alerts', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('알림 조건 판정: 하락/상승 타입에 맞게 임계값 도달 여부를 계산한다', () => {
    expect(
      shouldTriggerAlert(
        { alertType: PRICE_ALERT_TYPES.priceDrop, targetPrice: 1000 },
        900,
      ),
    ).toBe(true);

    expect(
      shouldTriggerAlert(
        { alertType: PRICE_ALERT_TYPES.priceRise, targetPrice: 1000 },
        1200,
      ),
    ).toBe(true);

    expect(
      shouldTriggerAlert(
        { alertType: PRICE_ALERT_TYPES.priceDrop, targetPrice: 1000 },
        1200,
      ),
    ).toBe(false);
  });

  test('알림 실행: 조건 충족 시 DM을 전송하고 lastTriggered를 갱신한다', async () => {
    const now = new Date('2026-02-23T01:00:00.000Z');
    const send = jest.fn().mockResolvedValue(undefined);
    const fetch = jest.fn().mockResolvedValue({ send });
    const client = {
      users: { fetch },
    };

    prisma.priceAlert.findMany.mockResolvedValue([
      {
        id: 11,
        userId: 'user-1',
        itemType: 'resource',
        itemKey: 'wood',
        alertType: PRICE_ALERT_TYPES.priceDrop,
        targetPrice: 100,
        isActive: true,
        lastTriggered: null,
        createdAt: new Date('2026-02-23T00:00:00.000Z'),
      },
    ]);
    prisma.tradeHistory.aggregate.mockResolvedValue({
      _sum: {
        price: 900,
        quantity: 10,
      },
    });
    prisma.priceAlert.update.mockResolvedValue({
      id: 11,
      lastTriggered: now,
    });

    const result = await runPriceAlertChecks(prisma, {
      client,
      now,
      cooldownMs: 60 * 60 * 1000,
    });

    expect(result.checkedCount).toBe(1);
    expect(result.triggeredCount).toBe(1);
    expect(result.sentCount).toBe(1);
    expect(fetch).toHaveBeenCalledWith('user-1');
    expect(send).toHaveBeenCalledTimes(1);
    expect(prisma.priceAlert.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { lastTriggered: now },
    });
  });

  test('쿨다운 중 알림은 재발송하지 않는다', async () => {
    const now = new Date('2026-02-23T02:00:00.000Z');
    const send = jest.fn().mockResolvedValue(undefined);
    const fetch = jest.fn().mockResolvedValue({ send });
    const client = {
      users: { fetch },
    };

    prisma.priceAlert.findMany.mockResolvedValue([
      {
        id: 99,
        userId: 'user-1',
        itemType: 'resource',
        itemKey: 'wood',
        alertType: PRICE_ALERT_TYPES.priceDrop,
        targetPrice: 100,
        isActive: true,
        lastTriggered: new Date('2026-02-23T01:30:00.000Z'),
        createdAt: new Date('2026-02-23T00:00:00.000Z'),
      },
    ]);
    prisma.tradeHistory.aggregate.mockResolvedValue({
      _sum: {
        price: 900,
        quantity: 10,
      },
    });

    const result = await runPriceAlertChecks(prisma, {
      client,
      now,
      cooldownMs: 60 * 60 * 1000,
    });

    expect(result.triggeredCount).toBe(0);
    expect(result.sentCount).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.priceAlert.update).not.toHaveBeenCalled();
  });
});
