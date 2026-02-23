const {
  JOB_TYPES,
  getJobRespecCost,
  refreshJobRespecDemand,
  canRespec,
} = require('../../src/game/job-respec');
const { createPrismaMock } = require('../helpers/prisma');

describe('job respec game logic', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('동적 배율을 반영해 재전직 비용을 계산한다', async () => {
    prisma.jobRespecDemand.findUnique.mockResolvedValue({ multiplier: 1.5 });

    const cost = await getJobRespecCost(JOB_TYPES.combat, 'warrior', prisma);

    expect(cost).toBe(7500);
  });

  test('수요 배율은 0.5x~2.0x 범위로 제한된다', async () => {
    prisma.jobRespecDemand.findUnique
      .mockResolvedValueOnce({ multiplier: 3.4 })
      .mockResolvedValueOnce({ multiplier: 0.2 });

    const highCost = await getJobRespecCost(JOB_TYPES.combat, 'warrior', prisma);
    const lowCost = await getJobRespecCost(JOB_TYPES.combat, 'warrior', prisma);

    expect(highCost).toBe(10000);
    expect(lowCost).toBe(2500);
  });

  test('최근 7일 재전직 기록으로 수요 통계를 갱신한다', async () => {
    const now = new Date('2026-02-23T12:00:00.000Z');

    prisma.jobRespecHistory.findMany.mockResolvedValue([
      { jobType: 'combat', toClass: 'warrior' },
      { jobType: 'combat', toClass: 'warrior' },
      { jobType: 'combat', toClass: 'warrior' },
      { jobType: 'combat', toClass: 'warrior' },
      { jobType: 'combat', toClass: 'ranger' },
      { jobType: 'production', toClass: 'blacksmith' },
      { jobType: 'production', toClass: 'blacksmith' },
    ]);
    prisma.jobRespecDemand.upsert.mockImplementation(async ({ create, update }) => ({
      ...create,
      ...update,
    }));

    await refreshJobRespecDemand(prisma, { now });

    const upserts = prisma.jobRespecDemand.upsert.mock.calls.map(([arg]) => arg);

    const warriorUpsert = upserts.find(
      (entry) => entry.where.jobType_jobClass.jobType === 'combat'
        && entry.where.jobType_jobClass.jobClass === 'warrior',
    );
    const rangerUpsert = upserts.find(
      (entry) => entry.where.jobType_jobClass.jobType === 'combat'
        && entry.where.jobType_jobClass.jobClass === 'ranger',
    );
    const sorcererUpsert = upserts.find(
      (entry) => entry.where.jobType_jobClass.jobType === 'combat'
        && entry.where.jobType_jobClass.jobClass === 'sorcerer',
    );

    expect(prisma.jobRespecHistory.findMany).toHaveBeenCalledTimes(1);
    expect(warriorUpsert.update.respecCount).toBe(4);
    expect(warriorUpsert.update.multiplier).toBe(2);
    expect(rangerUpsert.update.respecCount).toBe(1);
    expect(rangerUpsert.update.multiplier).toBe(0.6);
    expect(sorcererUpsert.update.respecCount).toBe(0);
    expect(sorcererUpsert.update.multiplier).toBe(0.5);
  });

  test('전투/생산 세션이 있으면 재전직 불가다', () => {
    const combatBlocked = canRespec({
      combatSession: { id: 'session-1' },
      gatherSessions: [],
      craftingSessions: [],
    });
    const productionBlocked = canRespec({
      combatSession: null,
      gatherSessions: [{ id: 'g1' }],
      craftingSessions: [],
    });
    const allowed = canRespec({
      combatSession: null,
      gatherSessions: [],
      craftingSessions: [],
    });

    expect(combatBlocked.allowed).toBe(false);
    expect(combatBlocked.reason).toContain('전투 중');
    expect(productionBlocked.allowed).toBe(false);
    expect(productionBlocked.reason).toContain('생산 중');
    expect(allowed.allowed).toBe(true);
  });
});
