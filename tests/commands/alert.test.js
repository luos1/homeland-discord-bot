const alertCommand = require('../../src/commands/alert');
const { PRICE_ALERT_TYPES } = require('../../src/game/price-alerts');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');

describe('alert command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('set: 가격 알림을 생성한다', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'set'),
        getString: jest.fn((name) => {
          if (name === 'item') return 'wood';
          if (name === 'type') return PRICE_ALERT_TYPES.priceDrop;
          return null;
        }),
        getInteger: jest.fn((name) => {
          if (name === 'price') return 100;
          return null;
        }),
        getBoolean: jest.fn(() => null),
      },
    });

    prisma.character.findUnique.mockResolvedValue({ id: 1 });
    prisma.priceAlert.count.mockResolvedValue(0);
    prisma.priceAlert.findFirst.mockResolvedValue(null);
    prisma.priceAlert.create.mockResolvedValue({
      id: 321,
      userId: interaction.user.id,
      itemType: 'resource',
      itemKey: 'wood',
      alertType: PRICE_ALERT_TYPES.priceDrop,
      targetPrice: 100,
      isActive: true,
    });

    await alertCommand.execute(interaction, { prisma });

    expect(prisma.priceAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: interaction.user.id,
        characterId: 1,
        itemType: 'resource',
        itemKey: 'wood',
        alertType: PRICE_ALERT_TYPES.priceDrop,
        targetPrice: 100,
        isActive: true,
      }),
    });
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('가격 알림을 등록');
  });

  test('list: 등록된 알림 목록을 임베드로 반환한다', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'list'),
        getString: jest.fn(() => null),
        getInteger: jest.fn(() => null),
        getBoolean: jest.fn(() => false),
      },
    });

    prisma.character.findUnique.mockResolvedValue({ id: 1 });
    prisma.priceAlert.findMany.mockResolvedValue([
      {
        id: 11,
        userId: interaction.user.id,
        itemType: 'resource',
        itemKey: 'wood',
        alertType: PRICE_ALERT_TYPES.priceDrop,
        targetPrice: 120,
        isActive: true,
        lastTriggered: null,
        createdAt: new Date('2026-02-23T00:00:00.000Z'),
      },
    ]);

    await alertCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].toJSON().description).toContain('#11 [ON]');
  });
});
