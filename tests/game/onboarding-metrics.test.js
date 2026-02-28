const { getOnboardingConversionMetrics } = require('../../src/game/onboarding-metrics');
const { createPrismaMock } = require('../helpers/prisma');

describe('onboarding metrics', () => {
  test('운영 메트릭을 요구 항목에 맞게 집계한다', async () => {
    const prisma = createPrismaMock();
    const now = new Date('2026-03-01T00:00:00.000Z');

    prisma.user.count.mockResolvedValue(12);
    prisma.character.count
      .mockResolvedValueOnce(34)
      .mockResolvedValueOnce(21);
    prisma.onboardingProgress.count.mockResolvedValue(8);
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { characterId: 1 },
      { characterId: 2 },
      { characterId: 3 },
    ]);
    prisma.serverInviteReward.count.mockResolvedValue(17);

    const result = await getOnboardingConversionMetrics(prisma, { now });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-02-28T00:00:00.000Z'),
        },
      },
    });

    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith({
      where: {
        streak: {
          gte: 7,
        },
      },
      distinct: ['characterId'],
      select: {
        characterId: true,
      },
    });

    expect(result).toEqual({
      measuredAt: now,
      newUsers24h: 12,
      onboardingQuestCompleted: {
        quest1: 34,
        quest2: 21,
        quest3: 8,
      },
      attendance7dAchieved: 3,
      inviteRewardClaimed: 17,
    });
  });
});
