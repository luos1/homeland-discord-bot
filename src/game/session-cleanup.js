// 전투 세션 자동 정리 유틸리티

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30분

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
 * 전역 세션 정리 (모든 오래된 세션)
 * 주기적으로 실행하거나 봇 시작 시 실행
 * @param {PrismaClient} prisma
 */
async function cleanupAllOldSessions(prisma) {
  const cleaned = await cleanupOldSessions(prisma);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old combat sessions`);
  }
  return cleaned;
}

module.exports = {
  cleanupOldSessions,
  forceEndUserSession,
  cleanupAllOldSessions,
  SESSION_TIMEOUT_MS,
};
