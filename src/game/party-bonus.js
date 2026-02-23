// 파티 보너스 시스템

/**
 * 파티 보너스 적용
 * @param {PrismaClient} prisma
 * @param {string} userId - Discord user ID
 * @param {number} baseXp - 기본 경험치
 * @param {number} baseGold - 기본 골드
 * @returns {Promise<{xp: number, gold: number, hasBonus: boolean, partySize: number}>}
 */
async function applyPartyBonus(prisma, userId, baseXp, baseGold) {
  // 파티 멤버인지 확인
  const membership = await prisma.partyMember.findFirst({
    where: { userId },
    include: {
      party: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!membership || !membership.party.isActive) {
    return {
      xp: baseXp,
      gold: baseGold,
      hasBonus: false,
      partySize: 1,
    };
  }

  const party = membership.party;
  const partySize = party.members.length;

  // 파티 보너스: 멤버 수에 따라 증가
  // 2명: +10%, 3명: +15%, 4명: +20%
  const bonusMultiplier = partySize >= 4 ? 1.2 : partySize === 3 ? 1.15 : partySize === 2 ? 1.1 : 1.0;

  return {
    xp: Math.floor(baseXp * bonusMultiplier),
    gold: Math.floor(baseGold * bonusMultiplier),
    hasBonus: bonusMultiplier > 1.0,
    partySize,
    bonusMultiplier,
  };
}

/**
 * 파티 정보 가져오기
 * @param {PrismaClient} prisma
 * @param {string} userId
 * @returns {Promise<{isInParty: boolean, party: Object|null}>}
 */
async function getPartyInfo(prisma, userId) {
  const membership = await prisma.partyMember.findFirst({
    where: { userId },
    include: {
      party: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!membership || !membership.party.isActive) {
    return {
      isInParty: false,
      party: null,
    };
  }

  return {
    isInParty: true,
    party: membership.party,
  };
}

module.exports = {
  applyPartyBonus,
  getPartyInfo,
};
