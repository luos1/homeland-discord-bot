const gemCommand = require('../../src/commands/gem');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const { createCharacter } = require('../helpers/factories');

describe('gem command', () => {
  let prisma;
  let tx;

  beforeEach(() => {
    prisma = createPrismaMock();
    tx = createTransactionMock();
    mockPrismaTransaction(prisma, tx);
    jest.clearAllMocks();
  });

  test('젬 매수: buy 실행 시 골드 차감 후 젬을 지급한다', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'buy'),
        getInteger: jest.fn((key) => (key === 'amount' ? 10 : null)),
      },
    });
    const character = createCharacter({
      id: 40,
      userId: interaction.user.id,
      gold: 5000,
      gems: 5,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.gemExchange.findMany.mockResolvedValue([]);

    await gemCommand.execute(interaction, { prisma });

    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: character.id },
      data: {
        gold: { decrement: 1260 },
        gems: { increment: 10 },
      },
    });
    expect(tx.gemExchange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: character.userId,
          orderType: 'buy',
          amount: 10,
          rate: 120,
          fee: 60,
          goldAmount: 1260,
          status: 'filled',
        }),
      }),
    );
    expect(tx.gemTransaction.create).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].embeds[0].data.title).toContain('매수 완료');
  });
});
