jest.mock('../../src/game/dynamic-pricing', () => ({
  getResourceDynamicPrice: jest.fn(),
  refreshAllResourceDynamicPrices: jest.fn(),
}));

const npcShopCommand = require('../../src/commands/npc_shop');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const {
  getResourceDynamicPrice,
  refreshAllResourceDynamicPrices,
} = require('../../src/game/dynamic-pricing');

describe('npc_shop command', () => {
  let prisma;
  let tx;

  beforeEach(() => {
    prisma = createPrismaMock();
    tx = createTransactionMock();
    mockPrismaTransaction(prisma, tx);
    jest.clearAllMocks();
    getResourceDynamicPrice.mockImplementation(async (_prisma, itemKey) => ({
      itemKey,
      basePrice: 100,
      currentMultiplier: 1.0,
      npcBuyPrice: 70,
      npcSellPrice: 130,
      supply24h: 100,
      demand24h: 100,
      supplyDemandRatio: 1,
      pressure: {
        key: 'balanced',
        label: '균형',
        emoji: '✅',
      },
      trend: 'stable',
    }));
    refreshAllResourceDynamicPrices.mockResolvedValue([]);
  });

  test('/npc_shop 실행 시 동적 시세 목록을 표시한다', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: jest.fn(() => null),
      },
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '상점유저',
      gold: 12345,
    });

    await npcShopCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('NPC 동적 상점');
    expect(payload.components.length).toBeGreaterThan(0);
    expect(getResourceDynamicPrice).toHaveBeenCalled();
  });

  test('/npc_shop resource 옵션으로 상세 시세를 표시한다', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: jest.fn(() => 'wood'),
      },
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '상점유저',
      gold: 12345,
    });

    await npcShopCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('NPC 상점 -');
    expect(payload.embeds[0].data.description).toContain('공급 상태');
  });

  test('상세 화면에서 판매 가능한 경우 NPC에게 판매 버튼이 활성화된다', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: jest.fn(() => 'wood'),
      },
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '상점유저',
      gold: 12345,
      resources: [
        {
          id: 11,
          type: 'wood',
          name: '목재',
          quantity: 8,
        },
      ],
    });

    await npcShopCommand.execute(interaction, { prisma });

    const payload = interaction.reply.mock.calls[0][0];
    const row = payload.components[0].toJSON();
    const sellButton = row.components.find((component) => component.custom_id === 'npcshop:sell:wood');

    expect(sellButton).toBeDefined();
    expect(sellButton.disabled).toBeFalsy();
  });

  test('판매 버튼 클릭 시 수량 입력 모달을 띄운다', async () => {
    const interaction = createMockInteraction({
      customId: 'npcshop:sell:wood',
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '상점유저',
      gold: 12345,
      resources: [
        {
          id: 11,
          type: 'wood',
          name: '목재',
          quantity: 8,
        },
      ],
    });

    const handled = await npcShopCommand.handleNpcShopButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    const modal = interaction.showModal.mock.calls[0][0].toJSON();
    expect(modal.custom_id).toBe('npcshop:sellmodal:wood');
  });

  test('판매 모달 제출 시 재고 차감/골드 지급/거래 로그를 기록한다', async () => {
    const interaction = createMockInteraction({
      customId: 'npcshop:sellmodal:wood',
      fields: {
        getTextInputValue: jest.fn(() => '3'),
      },
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '상점유저',
      gold: 500,
      resources: [
        {
          id: 31,
          type: 'wood',
          name: '목재',
          quantity: 7,
        },
      ],
    });

    tx.resource.findUnique.mockResolvedValue({
      id: 31,
      quantity: 7,
    });

    const handled = await npcShopCommand.handleNpcShopModal(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.resource.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: {
        quantity: { decrement: 3 },
      },
    });
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        gold: { increment: 210 },
        tradeVolume: { increment: 210 },
      },
    });
    expect(tx.tradeHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 1,
          buyerId: 0,
          itemType: 'resource',
          itemKey: 'wood',
          quantity: 3,
          price: 210,
        }),
      }),
    );
    expect(tx.dynamicPrice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          supply24h: { increment: 3 },
        }),
      }),
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('NPC 판매 완료');
  });

  test('refresh 버튼(main) 클릭 시 시세를 강제 갱신한다', async () => {
    const interaction = createMockInteraction({
      customId: 'npcshop:refresh',
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '상점유저',
      gold: 12345,
    });

    const handled = await npcShopCommand.handleNpcShopButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(refreshAllResourceDynamicPrices).toHaveBeenCalledTimes(1);
    expect(interaction.update).toHaveBeenCalledTimes(1);
  });
});
