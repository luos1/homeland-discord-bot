jest.mock('../../src/game/dynamic-pricing', () => ({
  getResourceDynamicPrice: jest.fn(),
}));

jest.mock('../../src/commands/npc_shop', () => ({
  executeNpcResourceSale: jest.fn(),
}));

const sellResourcesCommand = require('../../src/commands/sell_resources');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const { createCharacter, createResource } = require('../helpers/factories');
const { getResourceDynamicPrice } = require('../../src/game/dynamic-pricing');
const { executeNpcResourceSale } = require('../../src/commands/npc_shop');

describe('sell_resources command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
    getResourceDynamicPrice.mockResolvedValue({
      itemKey: 'wood',
      npcBuyPrice: 70,
    });
    executeNpcResourceSale.mockResolvedValue({
      itemKey: 'wood',
      quantity: 5,
      resource: {
        name: '목재',
        emoji: '🪵',
      },
      unitPrice: 70,
      totalPrice: 350,
      remainingQuantity: 5,
    });
  });

  test('/sell_resources 실행 시 보유 자원 목록과 매입가를 표시한다', async () => {
    const interaction = createMockInteraction();
    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        name: '테스터',
        gold: 1234,
        resources: [createResource({ type: 'wood', name: '목재', quantity: 10 })],
      }),
    );

    await sellResourcesCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('자원 판매소');
    expect(payload.embeds[0].data.description).toContain('목재');
    expect(payload.embeds[0].data.description).toContain('NPC 매입가');
    expect(payload.components.length).toBeGreaterThan(0);
  });

  test('빠른 판매(절반) 버튼 클릭 시 판매 처리 후 화면을 갱신한다', async () => {
    const interaction = createMockInteraction({
      customId: 'sellres:quick:wood:half',
    });
    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        id: 1,
        resources: [createResource({ type: 'wood', name: '목재', quantity: 10 })],
      }),
    );

    const handled = await sellResourcesCommand.handleSellResourcesButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(executeNpcResourceSale).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        characterId: 1,
        itemKey: 'wood',
        quantity: 5,
      }),
    );
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).toHaveBeenCalledTimes(1);
    expect(interaction.followUp.mock.calls[0][0].content).toContain('빠른 판매 완료');
  });

  test('판매 모달 제출 시 입력 수량으로 판매를 처리한다', async () => {
    const interaction = createMockInteraction({
      customId: 'sellres:sellmodal:wood',
      fields: {
        getTextInputValue: jest.fn(() => '3'),
      },
    });
    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        id: 1,
        resources: [createResource({ type: 'wood', name: '목재', quantity: 10 })],
      }),
    );
    executeNpcResourceSale.mockResolvedValue({
      itemKey: 'wood',
      quantity: 3,
      resource: {
        name: '목재',
        emoji: '🪵',
      },
      unitPrice: 70,
      totalPrice: 210,
      remainingQuantity: 7,
    });

    const handled = await sellResourcesCommand.handleSellResourcesModal(interaction, { prisma });

    expect(handled).toBe(true);
    expect(executeNpcResourceSale).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        characterId: 1,
        itemKey: 'wood',
        quantity: 3,
      }),
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('자원 판매 완료');
  });
});
