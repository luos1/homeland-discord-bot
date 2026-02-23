jest.mock('../../src/game/auction-house', () => ({
  AUCTION_FEE_RATE: 0.05,
  AUCTION_ALLOWED_DURATIONS_HOURS: [1, 6, 24],
  AUCTION_MIN_START_PRICE: 100,
  AUCTION_MAX_START_PRICE: 1_000_000_000,
  AUCTION_STATUSES: {
    active: 'active',
    completed: 'completed',
    cancelled: 'cancelled',
  },
  isAuctionableRarity: jest.fn((rarity) => ['rare', 'epic', 'legendary'].includes(rarity)),
  resolveMinimumBidAmount: jest.fn(() => 1200),
  listActiveAuctions: jest.fn(),
  listCharacterAuctions: jest.fn(),
  getAuctionDetail: jest.fn(),
  createAuction: jest.fn(),
  placeAuctionBid: jest.fn(),
  finalizeAuction: jest.fn(),
  getAuctionRemainingMs: jest.fn(() => 60 * 60 * 1000),
}));

const auctionCommand = require('../../src/commands/auction');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const {
  listActiveAuctions,
  listCharacterAuctions,
  getAuctionDetail,
  placeAuctionBid,
} = require('../../src/game/auction-house');

describe('auction command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();

    listActiveAuctions.mockResolvedValue([]);
    listCharacterAuctions.mockResolvedValue([]);
    getAuctionDetail.mockResolvedValue(null);
    placeAuctionBid.mockResolvedValue({
      bid: {
        bidAmount: 1500,
      },
      previousBidAmount: 1200,
      wasExtended: false,
      extensionMinutes: 0,
    });
  });

  test('/auction 실행 시 경매장 메인 임베드를 표시한다', async () => {
    const interaction = createMockInteraction();

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      userId: interaction.user.id,
      name: '경매유저',
      gold: 50000,
      equipment: [],
    });

    await auctionCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('경매장');
  });

  test('경매 등록 선택 메뉴에서 장비 선택 시 등록 모달을 연다', async () => {
    const interaction = createMockInteraction({
      customId: 'auction:select:create',
      values: ['11'],
    });

    const handled = await auctionCommand.handleAuctionSelect(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.showModal).toHaveBeenCalledTimes(1);
  });

  test('입찰 모달 제출 시 입찰 로직을 호출하고 완료 메시지를 보낸다', async () => {
    const interaction = createMockInteraction({
      customId: 'auction:bidmodal:5',
      fields: {
        getTextInputValue: jest.fn(() => '1500'),
      },
    });

    const handled = await auctionCommand.handleAuctionModal(interaction, { prisma });

    expect(handled).toBe(true);
    expect(placeAuctionBid).toHaveBeenCalledWith(
      expect.objectContaining({
        prisma,
        bidderUserId: interaction.user.id,
        auctionId: 5,
        bidAmount: 1500,
      }),
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('입찰 완료');
  });
});
