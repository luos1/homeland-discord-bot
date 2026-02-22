const shopCommand = require('../../src/commands/shop');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const { createCharacter, createEquipment } = require('../helpers/factories');

describe('shop command', () => {
  let prisma;
  let tx;

  beforeEach(() => {
    prisma = createPrismaMock();
    tx = createTransactionMock();
    mockPrismaTransaction(prisma, tx);
    jest.restoreAllMocks();
  });

  test('아이템 구매: 체력 포션 구매 시 골드를 차감한다', async () => {
    const interaction = createMockInteraction({
      customId: 'shop:buy_potion:health',
    });
    const character = createCharacter({
      id: 10,
      userId: interaction.user.id,
      gold: 200,
      equipment: [],
    });

    prisma.character.findUnique.mockResolvedValue(character);

    const handled = await shopCommand.handleShopButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: character.id },
      data: { gold: { decrement: 50 } },
    });
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('구매했습니다');
  });

  test('판매: 장비 판매 시 장비 삭제 후 골드를 지급한다', async () => {
    const interaction = createMockInteraction({
      customId: 'shop:sell_equipment:11',
    });
    const character = createCharacter({
      id: 10,
      userId: interaction.user.id,
      gold: 100,
      equipment: [],
    });
    const equipment = createEquipment({
      id: 11,
      characterId: character.id,
      rarity: 'common',
      equipped: false,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.equipment.findUnique.mockResolvedValue(equipment);

    const handled = await shopCommand.handleShopButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.equipment.delete).toHaveBeenCalledWith({
      where: { id: equipment.id },
    });
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: character.id },
      data: { gold: { increment: 30 } },
    });
    expect(interaction.reply.mock.calls[0][0].content).toContain('판매했습니다');
  });

  test('업그레이드: 강화 성공 시 레벨과 스탯이 증가한다', async () => {
    const interaction = createMockInteraction({
      customId: 'shop:upgrade_equipment:11',
    });
    const character = createCharacter({
      id: 10,
      userId: interaction.user.id,
      gold: 1000,
      equipment: [],
    });
    const equipment = createEquipment({
      id: 11,
      characterId: character.id,
      attack: 10,
      defense: 5,
      rarity: 'common',
      upgradeLevel: 0,
      equipped: false,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.equipment.findUnique.mockResolvedValue(equipment);
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const handled = await shopCommand.handleShopButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: character.id },
      data: { gold: { decrement: 200 } },
    });
    expect(tx.equipment.update).toHaveBeenCalledTimes(1);
    const updatePayload = tx.equipment.update.mock.calls[0][0];
    expect(updatePayload.where).toEqual({ id: equipment.id });
    expect(updatePayload.data.upgradeLevel).toBe(1);
    expect(updatePayload.data.attack).toBeGreaterThan(equipment.attack);
    expect(updatePayload.data.defense).toBeGreaterThan(equipment.defense);
    expect(interaction.reply.mock.calls[0][0].content).toContain('강화 성공');
  });
});
