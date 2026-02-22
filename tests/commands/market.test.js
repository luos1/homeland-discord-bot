const marketCommand = require('../../src/commands/market');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const {
  createCharacter,
  createMarketListing,
  createResource,
} = require('../helpers/factories');

describe('market command', () => {
  let prisma;
  let tx;

  beforeEach(() => {
    prisma = createPrismaMock();
    tx = createTransactionMock();
    mockPrismaTransaction(prisma, tx);
  });

  test('리소스 거래: buy select 처리 시 구매/정산/상태변경을 수행한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:buy:resource',
      values: ['51'],
    });
    const buyer = createCharacter({
      id: 1,
      userId: interaction.user.id,
      gold: 500,
      resources: [],
    });
    const listing = createMarketListing({
      id: 51,
      sellerId: 2,
      itemType: 'resource',
      itemKey: 'wood',
      itemName: '목재',
      quantity: 3,
      pricePerUnit: 50,
      status: 'active',
    });

    prisma.character.findUnique.mockResolvedValue(buyer);
    prisma.marketListing.findUnique.mockResolvedValue(listing);
    tx.marketListing.findUnique.mockResolvedValue(listing);
    tx.resource.findUnique.mockResolvedValue(null);
    tx.resource.create.mockResolvedValue(createResource({ characterId: buyer.id, quantity: 3 }));

    const handled = await marketCommand.handleMarketSelect(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.character.update).toHaveBeenCalledTimes(2);
    expect(tx.marketListing.update).toHaveBeenCalledWith({
      where: { id: listing.id },
      data: expect.objectContaining({
        status: 'sold',
        buyerId: buyer.id,
      }),
    });
    expect(tx.tradeHistory.create).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('구매 완료');
  });
});
