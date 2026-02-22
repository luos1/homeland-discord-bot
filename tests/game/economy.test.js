const {
  getResourceBasePrice,
  calculateNpcResourcePrice,
  applyCombatEconomyAdjustments,
  simulateGoldCirculation,
} = require('../../src/game/economy');

describe('economy balancing', () => {
  test('NPC 동적 가격: 공급 과잉이면 하락하고 공급 부족이면 상승한다', () => {
    const oversupply = calculateNpcResourcePrice({
      resourceType: 'wood',
      supplyQuantity: 420,
      demandQuantity: 20,
      recentAveragePrice: getResourceBasePrice('wood'),
    });

    const shortage = calculateNpcResourcePrice({
      resourceType: 'wood',
      supplyQuantity: 8,
      demandQuantity: 220,
      recentAveragePrice: getResourceBasePrice('wood'),
    });

    expect(oversupply.unitPrice).toBeLessThan(getResourceBasePrice('wood'));
    expect(shortage.unitPrice).toBeGreaterThan(getResourceBasePrice('wood'));
    expect(shortage.unitPrice).toBeGreaterThan(oversupply.unitPrice);
  });

  test('NPC 동적 가격: 서킷브레이커가 급격한 변동을 제한한다', () => {
    const basePrice = getResourceBasePrice('wood');
    const spiky = calculateNpcResourcePrice({
      resourceType: 'wood',
      supplyQuantity: 0,
      demandQuantity: 999,
      recentAveragePrice: basePrice,
      previousPrice: basePrice,
    });

    expect(spiky.circuitBreakerTriggered).toBe(true);
    expect(spiky.unitPrice).toBeLessThanOrEqual(Math.round(basePrice * 1.12));
  });

  test('전투 경제 보정: 수리비가 반영되어 순골드 변동이 계산된다', () => {
    const result = applyCombatEconomyAdjustments({
      currentGold: 1000,
      grossGoldReward: 180,
      maxHp: 100,
      currentHp: 25,
      level: 12,
      isDefeat: false,
    });

    expect(result.appliedRepair).toBeGreaterThan(0);
    expect(result.nextGold).toBeLessThan(1180);
    expect(result.nextGold).toBeGreaterThanOrEqual(0);
  });

  test('골드 유통 시뮬레이션: 일 단위 결과와 인플레이션 지표를 반환한다', () => {
    const simulation = simulateGoldCirculation({
      days: 10,
      initialGold: 150000,
      activePlayers: 80,
      avgBattlesPerPlayer: 4,
      avgGrossCombatReward: 30,
    });

    expect(simulation.timeline).toHaveLength(10);
    expect(simulation.summary.firstTotal).toBeGreaterThan(0);
    expect(Number.isFinite(simulation.summary.inflationRate)).toBe(true);
    expect(Number.isInteger(simulation.summary.averageNetPerDay)).toBe(true);
  });
});
