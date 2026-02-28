const DAY_IN_MS = 24 * 60 * 60 * 1000;

async function getOnboardingConversionMetrics(prisma, { now = new Date() } = {}) {
  const recent24h = new Date(now.getTime() - DAY_IN_MS);

  const [
    newUsers24h,
    quest1Completed,
    quest2Completed,
    quest3Completed,
    attendance7dAchievedRows,
    inviteRewardClaimed,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: {
          gte: recent24h,
        },
      },
    }),
    prisma.character.count(),
    prisma.character.count({
      where: {
        battleWins: {
          gte: 1,
        },
      },
    }),
    prisma.onboardingProgress.count({
      where: {
        giftSent: true,
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        streak: {
          gte: 7,
        },
      },
      distinct: ['characterId'],
      select: {
        characterId: true,
      },
    }),
    prisma.serverInviteReward.count({
      where: {
        rewardClaimed: true,
      },
    }),
  ]);

  return {
    measuredAt: now,
    newUsers24h,
    onboardingQuestCompleted: {
      quest1: quest1Completed,
      quest2: quest2Completed,
      quest3: quest3Completed,
    },
    attendance7dAchieved: attendance7dAchievedRows.length,
    inviteRewardClaimed,
  };
}

module.exports = {
  getOnboardingConversionMetrics,
};
