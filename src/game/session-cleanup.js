// 전투 세션 자동 정리 유틸리티

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const PRODUCTION_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24시간 (생산 세션용)

/**
 * 오래된 전투 세션 정리
 * @param {PrismaClient} prisma
 * @param {string} userId - 특정 유저의 세션만 정리 (optional)
 * @returns {Promise<number>} 정리된 세션 수
 */
async function cleanupOldSessions(prisma, userId = null) {
  const cutoffTime = new Date(Date.now() - SESSION_TIMEOUT_MS);

  const where = {
    updatedAt: {
      lt: cutoffTime,
    },
  };

  if (userId) {
    // 특정 유저의 세션만 정리
    where.character = {
      userId,
    };
  }

  try {
    const result = await prisma.combatSession.deleteMany({
      where,
    });

    return result.count;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return 0;
  }
}

/**
 * 오래된 생산 세션(채집/제작) 정리 (24시간 이상 경과)
 * @param {PrismaClient} prisma
 * @returns {Promise<number>} 정리된 세션 수
 */
async function cleanupOldProductionSessions(prisma) {
  const cutoffTime = new Date(Date.now() - PRODUCTION_SESSION_TIMEOUT_MS);
  let cleaned = 0;

  try {
    const gatherResult = await prisma.gatherSession.deleteMany({
      where: {
        updatedAt: { lt: cutoffTime },
      },
    });
    cleaned += gatherResult.count;

    const craftResult = await prisma.craftingSession.deleteMany({
      where: {
        updatedAt: { lt: cutoffTime },
      },
    });
    cleaned += craftResult.count;

    return cleaned;
  } catch (error) {
    console.error('Failed to cleanup old production sessions:', error);
    return 0;
  }
}

/**
 * 특정 유저의 활성 세션 강제 종료
 * @param {PrismaClient} prisma
 * @param {string} userId
 * @returns {Promise<boolean>} 세션이 존재했는지 여부
 */
async function forceEndUserSession(prisma, userId) {
  try {
    const session = await prisma.combatSession.findFirst({
      where: {
        character: {
          userId,
        },
      },
    });

    if (!session) {
      return false;
    }

    await prisma.combatSession.delete({
      where: {
        id: session.id,
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to force end session:', error);
    return false;
  }
}

/**
 * 전역 세션 정리 (모든 오래된 세션 - 전투 + 생산)
 * 주기적으로 실행하거나 봇 시작 시 실행
 * @param {PrismaClient} prisma
 */
async function cleanupAllOldSessions(prisma) {
  const combatCleaned = await cleanupOldSessions(prisma);
  const productionCleaned = await cleanupOldProductionSessions(prisma);
  const total = combatCleaned + productionCleaned;

  if (combatCleaned > 0) {
    console.log(`🧹 Cleaned up ${combatCleaned} old combat sessions`);
  }
  if (productionCleaned > 0) {
    console.log(`🧹 Cleaned up ${productionCleaned} old production sessions`);
  }

  return total;
}

module.exports = {
  cleanupOldSessions,
  cleanupOldProductionSessions,
  forceEndUserSession,
  cleanupAllOldSessions,
  SESSION_TIMEOUT_MS,
};
