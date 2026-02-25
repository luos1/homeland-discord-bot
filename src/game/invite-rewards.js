const INVITE_CODE_PREFIX = 'HM-';

const INVITE_REWARD_AMOUNTS = Object.freeze({
  inviterOnJoinGems: 30,
  inviterOnLevel10Gems: 50,
  inviterOnLevel30Gems: 100,
  inviteeOnJoinGold: 500,
  inviteeOnLevel10Gems: 20,
});

const REWARD_FLAGS = Object.freeze({
  inviterOnJoin: 'inviterOnJoin',
  inviterOnLevel10: 'inviterOnLevel10',
  inviterOnLevel30: 'inviterOnLevel30',
  inviteeOnJoin: 'inviteeOnJoin',
  inviteeOnLevel10: 'inviteeOnLevel10',
});

function normalizeInviteCode(inviteCode = '') {
  return String(inviteCode || '').trim().toUpperCase();
}

function generateInviteCode(userId) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  const encoded = Buffer.from(normalizedUserId, 'utf8').toString('hex').toUpperCase();
  return `${INVITE_CODE_PREFIX}${encoded}`;
}

function decodeInviteCode(inviteCode) {
  const normalizedCode = normalizeInviteCode(inviteCode);

  if (!normalizedCode.startsWith(INVITE_CODE_PREFIX)) {
    return null;
  }

  const encoded = normalizedCode.slice(INVITE_CODE_PREFIX.length);

  if (!encoded || encoded.length % 2 !== 0 || /[^0-9A-F]/.test(encoded)) {
    return null;
  }

  try {
    return Buffer.from(encoded, 'hex').toString('utf8');
  } catch (error) {
    return null;
  }
}

function createDefaultRewardState() {
  return {
    [REWARD_FLAGS.inviterOnJoin]: false,
    [REWARD_FLAGS.inviterOnLevel10]: false,
    [REWARD_FLAGS.inviterOnLevel30]: false,
    [REWARD_FLAGS.inviteeOnJoin]: false,
    [REWARD_FLAGS.inviteeOnLevel10]: false,
  };
}

function normalizeRewardState(rewardsClaimed) {
  const normalized = createDefaultRewardState();

  if (!rewardsClaimed || typeof rewardsClaimed !== 'object' || Array.isArray(rewardsClaimed)) {
    return normalized;
  }

  Object.values(REWARD_FLAGS).forEach((flag) => {
    normalized[flag] = rewardsClaimed[flag] === true;
  });

  return normalized;
}

function createInitialRewardState() {
  return {
    ...createDefaultRewardState(),
    [REWARD_FLAGS.inviterOnJoin]: true,
    [REWARD_FLAGS.inviteeOnJoin]: true,
  };
}

function calculateRewardTotals(rewardState) {
  const safeState = normalizeRewardState(rewardState);

  return {
    inviterGems:
      (safeState[REWARD_FLAGS.inviterOnJoin] ? INVITE_REWARD_AMOUNTS.inviterOnJoinGems : 0)
      + (safeState[REWARD_FLAGS.inviterOnLevel10] ? INVITE_REWARD_AMOUNTS.inviterOnLevel10Gems : 0)
      + (safeState[REWARD_FLAGS.inviterOnLevel30] ? INVITE_REWARD_AMOUNTS.inviterOnLevel30Gems : 0),
    inviteeGold: safeState[REWARD_FLAGS.inviteeOnJoin] ? INVITE_REWARD_AMOUNTS.inviteeOnJoinGold : 0,
    inviteeGems: safeState[REWARD_FLAGS.inviteeOnLevel10] ? INVITE_REWARD_AMOUNTS.inviteeOnLevel10Gems : 0,
  };
}

async function applyInviteUseRewards(prisma, { inviterCharacterId, inviteeCharacterId, inviteCode, inviteeLevel }) {
  const normalizedCode = normalizeInviteCode(inviteCode);
  const initialRewardState = createInitialRewardState();

  const [record] = await prisma.$transaction([
    prisma.inviteRecord.create({
      data: {
        inviterId: inviterCharacterId,
        inviteeId: inviteeCharacterId,
        inviteCode: normalizedCode,
        inviteeLevel: Math.max(1, Math.floor(inviteeLevel || 1)),
        rewardsClaimed: initialRewardState,
      },
    }),
    prisma.character.update({
      where: {
        id: inviterCharacterId,
      },
      data: {
        gems: {
          increment: INVITE_REWARD_AMOUNTS.inviterOnJoinGems,
        },
      },
    }),
    prisma.character.update({
      where: {
        id: inviteeCharacterId,
      },
      data: {
        gold: {
          increment: INVITE_REWARD_AMOUNTS.inviteeOnJoinGold,
        },
      },
    }),
  ]);

  return {
    record,
    rewards: {
      inviterGems: INVITE_REWARD_AMOUNTS.inviterOnJoinGems,
      inviteeGold: INVITE_REWARD_AMOUNTS.inviteeOnJoinGold,
    },
    rewardState: initialRewardState,
  };
}

async function checkInviteLevelRewards(prismaOrTx, inviteeCharacterId, currentLevel) {
  const safeLevel = Math.max(1, Math.floor(currentLevel || 1));

  const record = await prismaOrTx.inviteRecord.findUnique({
    where: {
      inviteeId: inviteeCharacterId,
    },
  });

  if (!record) {
    return {
      hasInvite: false,
      inviterGemReward: 0,
      inviteeGemReward: 0,
      grantedRewards: [],
      rewardState: createDefaultRewardState(),
    };
  }

  const nextRewardState = normalizeRewardState(record.rewardsClaimed);
  const grantedRewards = [];

  let inviterGemReward = 0;
  let inviteeGemReward = 0;

  if (safeLevel >= 10 && !nextRewardState[REWARD_FLAGS.inviterOnLevel10]) {
    nextRewardState[REWARD_FLAGS.inviterOnLevel10] = true;
    inviterGemReward += INVITE_REWARD_AMOUNTS.inviterOnLevel10Gems;
    grantedRewards.push('inviter_level_10');
  }

  if (safeLevel >= 30 && !nextRewardState[REWARD_FLAGS.inviterOnLevel30]) {
    nextRewardState[REWARD_FLAGS.inviterOnLevel30] = true;
    inviterGemReward += INVITE_REWARD_AMOUNTS.inviterOnLevel30Gems;
    grantedRewards.push('inviter_level_30');
  }

  if (safeLevel >= 10 && !nextRewardState[REWARD_FLAGS.inviteeOnLevel10]) {
    nextRewardState[REWARD_FLAGS.inviteeOnLevel10] = true;
    inviteeGemReward += INVITE_REWARD_AMOUNTS.inviteeOnLevel10Gems;
    grantedRewards.push('invitee_level_10');
  }

  const shouldUpdateLevel = safeLevel > (record.inviteeLevel || 1);
  const shouldGrantReward = inviterGemReward > 0 || inviteeGemReward > 0;

  if (!shouldUpdateLevel && !shouldGrantReward) {
    return {
      hasInvite: true,
      inviterGemReward: 0,
      inviteeGemReward: 0,
      grantedRewards: [],
      rewardState: nextRewardState,
    };
  }

  if (inviterGemReward > 0) {
    await prismaOrTx.character.update({
      where: {
        id: record.inviterId,
      },
      data: {
        gems: {
          increment: inviterGemReward,
        },
      },
    });
  }

  if (inviteeGemReward > 0) {
    await prismaOrTx.character.update({
      where: {
        id: record.inviteeId,
      },
      data: {
        gems: {
          increment: inviteeGemReward,
        },
      },
    });
  }

  await prismaOrTx.inviteRecord.update({
    where: {
      id: record.id,
    },
    data: {
      inviteeLevel: Math.max(record.inviteeLevel || 1, safeLevel),
      rewardsClaimed: nextRewardState,
    },
  });

  return {
    hasInvite: true,
    inviterGemReward,
    inviteeGemReward,
    grantedRewards,
    rewardState: nextRewardState,
  };
}

module.exports = {
  INVITE_REWARD_AMOUNTS,
  REWARD_FLAGS,
  generateInviteCode,
  normalizeInviteCode,
  decodeInviteCode,
  normalizeRewardState,
  calculateRewardTotals,
  applyInviteUseRewards,
  checkInviteLevelRewards,
};
