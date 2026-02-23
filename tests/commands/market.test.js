const marketCommand = require('../../src/commands/market');
const { MARKET_FEE_RATE } = marketCommand;
const { calculateNpcResourcePrice } = require('../../src/game/economy');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const {
  createCharacter,
  createEquipment,
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

  test('주문장: 매수 주문 모달 처리 시 예약금을 차감하고 주문을 등록한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:ordermodal:buy:wood',
      fields: {
        getTextInputValue: jest.fn((field) => {
          if (field === 'quantity') return '2';
          if (field === 'price') return '50';
          return '';
        }),
      },
    });

    const buyer = createCharacter({
      id: 1,
      userId: interaction.user.id,
      gold: 500,
      resources: [],
    });

    prisma.character.findUnique.mockResolvedValue(buyer);
    tx.character.findUnique.mockResolvedValue({ gold: 500 });
    tx.orderBook.create.mockResolvedValue({
      id: 901,
      type: 'buy',
      itemType: 'resource',
      itemKey: 'wood',
      itemName: '목재',
      price: 50,
      quantity: 2,
      characterId: buyer.id,
      status: 'open',
      createdAt: new Date('2026-02-22T00:00:00.000Z'),
    });
    tx.orderBook.findFirst.mockResolvedValue(null);
    tx.orderBook.findUnique.mockResolvedValue({
      id: 901,
      quantity: 2,
      status: 'open',
    });

    const handled = await marketCommand.handleMarketModal(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: buyer.id },
      data: {
        gold: { decrement: 100 },
      },
    });
    expect(tx.orderBook.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'buy',
          itemKey: 'wood',
          quantity: 2,
          price: 50,
        }),
      }),
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('매수 주문 등록 완료');
  });

  test('주문장: 주문 모달 열기 시 AI 추천가를 가격 입력 필드에 표시한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:place:buy:wood',
    });

    const buyer = createCharacter({
      id: 1,
      userId: interaction.user.id,
      gold: 5000,
      resources: [],
    });

    prisma.character.findUnique.mockResolvedValue(buyer);
    prisma.tradeHistory.aggregate
      .mockResolvedValueOnce({
        _sum: {
          price: 7000,
          quantity: 100,
        },
        _count: {
          _all: 12,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          price: 1400,
          quantity: 10,
        },
        _count: {
          _all: 4,
        },
      });
    prisma.tradeHistory.findMany.mockResolvedValue([
      {
        quantity: 1,
        price: 140,
      },
    ]);

    const handled = await marketCommand.handleMarketButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.showModal).toHaveBeenCalledTimes(1);

    const modal = interaction.showModal.mock.calls[0][0].toJSON();
    const priceInput = modal.components[1].components[0];

    expect(priceInput.label).toContain('추천');
    expect(priceInput.placeholder).toBe('154');
  });

  test('NPC 즉시 매입: 동적 단가로 자원을 판매하고 골드를 지급한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:npcmodal:wood',
      fields: {
        getTextInputValue: jest.fn(() => '3'),
      },
    });

    const seller = createCharacter({
      id: 1,
      userId: interaction.user.id,
      gold: 200,
      resources: [
        createResource({
          id: 41,
          characterId: 1,
          type: 'wood',
          name: '목재',
          quantity: 10,
        }),
      ],
    });

    const expectedUnitPrice = calculateNpcResourcePrice({
      resourceType: 'wood',
      supplyQuantity: 0,
      demandQuantity: 0,
      recentAveragePrice: 0,
    }).unitPrice;
    const expectedTotalPrice = expectedUnitPrice * 3;

    prisma.character.findUnique.mockResolvedValue(seller);
    prisma.orderBook.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.tradeHistory.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    tx.tradeHistory.create.mockResolvedValue({
      sellerId: seller.id,
      buyerId: 0,
      itemType: 'resource',
      itemKey: 'wood',
      itemName: '목재',
      quantity: 3,
      price: expectedTotalPrice,
      fee: 0,
      createdAt: new Date('2026-02-22T00:00:00.000Z'),
    });

    const handled = await marketCommand.handleMarketModal(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.resource.update).toHaveBeenCalledWith({
      where: { id: 41 },
      data: {
        quantity: { decrement: 3 },
      },
    });
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: seller.id },
      data: {
        gold: { increment: expectedTotalPrice },
        tradeVolume: { increment: expectedTotalPrice },
      },
    });
    expect(tx.tradeHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: seller.id,
          buyerId: 0,
          itemKey: 'wood',
          quantity: 3,
          price: expectedTotalPrice,
          fee: 0,
        }),
      }),
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('NPC 즉시 매입 완료');
  });

  test('장비 거래: 판매 등록 모달 처리 시 JSON 스냅샷 저장 후 장비를 에스크로 보관한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:equipmentmodal:11',
      fields: {
        getTextInputValue: jest.fn((field) => (field === 'price' ? '1200' : '')),
      },
    });
    const seller = createCharacter({
      id: 1,
      userId: interaction.user.id,
      equipment: [
        createEquipment({
          id: 11,
          characterId: 1,
          name: '정령의 검',
          type: 'weapon',
          rarity: 'rare',
          attack: 22,
          defense: 4,
          hp: 0,
          mana: 0,
          effect: null,
          equipped: false,
          upgradeLevel: 1,
        }),
      ],
      resources: [],
    });

    prisma.character.findUnique.mockResolvedValue(seller);
    tx.equipment.findUnique.mockResolvedValue(seller.equipment[0]);
    tx.marketListing.findFirst.mockResolvedValue(null);

    const handled = await marketCommand.handleMarketModal(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.marketListing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: seller.id,
          itemType: 'equipment',
          itemKey: '11',
          itemName: '정령의 검',
          quantity: 1,
          pricePerUnit: 1200,
          totalPrice: 1200,
          itemData: expect.objectContaining({
            name: '정령의 검',
            type: 'weapon',
            rarity: 'rare',
            attack: 22,
            defense: 4,
            upgradeLevel: 1,
          }),
        }),
      }),
    );
    expect(tx.equipment.delete).toHaveBeenCalledWith({
      where: { id: 11 },
    });
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('거래소에 등록했습니다');
  });

  test('장비 거래: 등급/타입 필터 선택 시 조건에 맞는 목록만 노출한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:eqfilterrarity:weapon',
      values: ['legendary'],
    });
    const listings = [
      createMarketListing({
        id: 71,
        itemType: 'equipment',
        itemKey: '301',
        itemName: '천둥 검',
        quantity: 1,
        pricePerUnit: 3000,
        totalPrice: 3000,
        status: 'active',
        itemData: {
          name: '천둥 검',
          type: 'weapon',
          rarity: 'legendary',
          attack: 40,
          defense: 5,
          hp: 0,
          mana: 0,
          effect: null,
          upgradeLevel: 2,
        },
      }),
      createMarketListing({
        id: 72,
        itemType: 'equipment',
        itemKey: '302',
        itemName: '영웅 도끼',
        quantity: 1,
        pricePerUnit: 2500,
        totalPrice: 2500,
        status: 'active',
        itemData: {
          name: '영웅 도끼',
          type: 'weapon',
          rarity: 'epic',
          attack: 33,
          defense: 4,
          hp: 0,
          mana: 0,
          effect: null,
          upgradeLevel: 0,
        },
      }),
      createMarketListing({
        id: 73,
        itemType: 'equipment',
        itemKey: '303',
        itemName: '전설 갑옷',
        quantity: 1,
        pricePerUnit: 2800,
        totalPrice: 2800,
        status: 'active',
        itemData: {
          name: '전설 갑옷',
          type: 'armor',
          rarity: 'legendary',
          attack: 0,
          defense: 35,
          hp: 40,
          mana: 0,
          effect: null,
          upgradeLevel: 1,
        },
      }),
    ];

    prisma.marketListing.findMany.mockResolvedValue(listings);

    const handled = await marketCommand.handleMarketSelect(interaction, { prisma });
    const expectedSellerNet = 2000 - Math.floor(2000 * MARKET_FEE_RATE);

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);

    const updatePayload = interaction.update.mock.calls[0][0];
    const description = updatePayload.embeds[0].toJSON().description;

    expect(description).toContain('등록 수: 1개');
    expect(description).toContain('천둥 검');
    expect(description).not.toContain('영웅 도끼');
    expect(description).not.toContain('전설 갑옷');
  });

  test('장비 거래: 구매 처리 시 정산과 소유권 이전을 수행한다', async () => {
    const interaction = createMockInteraction({
      customId: 'market:equipmentbuy',
      values: ['81'],
    });
    const buyer = createCharacter({
      id: 1,
      userId: interaction.user.id,
      gold: 5000,
      resources: [],
      equipment: [],
    });
    const listing = createMarketListing({
      id: 81,
      sellerId: 2,
      itemType: 'equipment',
      itemKey: '411',
      itemName: '천둥의 망치',
      quantity: 1,
      pricePerUnit: 2000,
      totalPrice: 2000,
      status: 'active',
      itemData: {
        name: '천둥의 망치',
        type: 'weapon',
        rarity: 'legendary',
        attack: 55,
        defense: 8,
        hp: 0,
        mana: 0,
        effect: 'lightning',
        upgradeLevel: 2,
      },
    });

    prisma.character.findUnique.mockResolvedValue(buyer);
    prisma.marketListing.findUnique.mockResolvedValue(listing);
    tx.marketListing.findUnique.mockResolvedValue(listing);
    tx.character.updateMany.mockResolvedValue({ count: 1 });

    const handled = await marketCommand.handleMarketSelect(interaction, { prisma });
    const expectedSellerNet = 2000 - Math.floor(2000 * MARKET_FEE_RATE);

    expect(handled).toBe(true);
    expect(tx.character.updateMany).toHaveBeenCalledWith({
      where: {
        id: buyer.id,
        gold: { gte: 2000 },
      },
      data: {
        gold: { decrement: 2000 },
        tradeVolume: { increment: 2000 },
      },
    });
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: listing.sellerId },
      data: {
        gold: { increment: expectedSellerNet },
        tradeVolume: { increment: 2000 },
      },
    });
    expect(tx.equipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: buyer.id,
          name: '천둥의 망치',
          type: 'weapon',
          rarity: 'legendary',
          attack: 55,
          defense: 8,
          effect: 'lightning',
          equipped: false,
          upgradeLevel: 2,
        }),
      }),
    );
    expect(tx.marketListing.update).toHaveBeenCalledWith({
      where: { id: listing.id },
      data: expect.objectContaining({
        status: 'sold',
        buyerId: buyer.id,
      }),
    });
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('구매 완료');
    expect(interaction.reply.mock.calls[0][0].content).toContain('천둥의 망치');
  });
});
