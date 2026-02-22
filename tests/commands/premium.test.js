const premiumCommand = require('../../src/commands/premium');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const { createCharacter } = require('../helpers/factories');

describe('premium command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-22T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('구독 활성화: subscribe 실행 시 Premium 구독이 생성된다', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'subscribe'),
      },
    });
    const character = createCharacter({
      id: 30,
      userId: interaction.user.id,
      name: '프리미엄러',
    });
    const now = new Date('2026-02-22T03:00:00.000Z');
    const endDate = new Date('2026-03-24T03:00:00.000Z');

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.premiumSubscription.findUnique.mockResolvedValue(null);
    prisma.premiumSubscription.upsert.mockResolvedValue({
      userId: interaction.user.id,
      planId: 'premium_monthly_999',
      startDate: now,
      endDate,
    });

    await premiumCommand.execute(interaction, { prisma });

    expect(prisma.premiumSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: interaction.user.id,
          planId: 'premium_monthly_999',
        }),
      }),
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].data.title).toContain('Premium Pass 활성화');
    expect(payload.embeds[0].data.description).toContain('$9.99');
  });
});
