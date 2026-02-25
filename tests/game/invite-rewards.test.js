const {
  INVITE_REWARD_AMOUNTS,
  applyInviteUseRewards,
  checkInviteLevelRewards,
  decodeInviteCode,
  generateInviteCode,
} = require('../../src/game/invite-rewards');
const { createPrismaMock } = require('../helpers/prisma');

describe('invite rewards', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('초대 코드 생성/복원: userId 기반으로 고유 코드가 생성된다', () => {
    const userId = '123456789012345678';
    const code = generateInviteCode(userId);

    expect(code.startsWith('HM-')).toBe(true);
    expect(decodeInviteCode(code)).toBe(userId);
    expect(decodeInviteCode('INVALID')).toBeNull();
  });

  test('초대 등록 보상: 초대자 보석 +30, 피초대자 골드 +500을 지급한다', async () => {
    prisma.inviteRecord.create.mockResolvedValue({ id: 11 });
    prisma.character.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (queries) => Promise.all(queries));

    const result = await applyInviteUseRewards(prisma, {
      inviterCharacterId: 7,
      inviteeCharacterId: 9,
      inviteCode: generateInviteCode('inviter-user'),
      inviteeLevel: 3,
    });

    expect(prisma.inviteRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviterId: 7,
          inviteeId: 9,
          inviteeLevel: 3,
          rewardsClaimed: expect.objectContaining({
            inviterOnJoin: true,
            inviteeOnJoin: true,
          }),
        }),
      }),
    );

    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: {
          gems: {
            increment: INVITE_REWARD_AMOUNTS.inviterOnJoinGems,
          },
        },
      }),
    );

    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9 },
        data: {
          gold: {
            increment: INVITE_REWARD_AMOUNTS.inviteeOnJoinGold,
          },
        },
      }),
    );

    expect(result.rewards).toEqual({
      inviterGems: 100,  // Updated: 30 → 100
      inviteeGold: 2000,  // Updated: 500 → 2000
    });
  });

  test('레벨 10 보상: 초대자 +50보석, 피초대자 +20보석을 1회만 지급한다', async () => {
    prisma.inviteRecord.findUnique.mockResolvedValue({
      id: 101,
      inviterId: 2,
      inviteeId: 3,
      inviteeLevel: 8,
      rewardsClaimed: {
        inviterOnJoin: true,
        inviteeOnJoin: true,
      },
    });
    prisma.character.update.mockResolvedValue({});
    prisma.inviteRecord.update.mockResolvedValue({});

    const result = await checkInviteLevelRewards(prisma, 3, 10);

    expect(result.hasInvite).toBe(true);
    expect(result.inviterGemReward).toBe(200);  // Updated: 50 → 200
    expect(result.inviteeGemReward).toBe(100);  // Updated: 20 → 100

    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        gems: {
          increment: 200,  // Updated: 50 → 200
        },
      },
    });

    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        gems: {
          increment: 100,  // Updated: 20 → 100
        },
      },
    });

    expect(prisma.inviteRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101 },
        data: expect.objectContaining({
          inviteeLevel: 10,
          rewardsClaimed: expect.objectContaining({
            inviterOnLevel10: true,
            inviteeOnLevel10: true,
          }),
        }),
      }),
    );
  });

  test('레벨 30 보상: 레벨10 보상이 이미 지급되었으면 초대자 +100보석만 지급한다', async () => {
    prisma.inviteRecord.findUnique.mockResolvedValue({
      id: 102,
      inviterId: 12,
      inviteeId: 15,
      inviteeLevel: 20,
      rewardsClaimed: {
        inviterOnJoin: true,
        inviteeOnJoin: true,
        inviterOnLevel10: true,
        inviteeOnLevel10: true,
      },
    });
    prisma.character.update.mockResolvedValue({});
    prisma.inviteRecord.update.mockResolvedValue({});

    const result = await checkInviteLevelRewards(prisma, 15, 31);

    expect(result.inviterGemReward).toBe(500);  // Updated: 100 → 500
    expect(result.inviteeGemReward).toBe(0);
    expect(prisma.character.update).toHaveBeenCalledTimes(1);
    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        gems: {
          increment: 500,  // Updated: 100 → 500
        },
      },
    });
    expect(prisma.inviteRecord.update).toHaveBeenCalled();
  });
});
