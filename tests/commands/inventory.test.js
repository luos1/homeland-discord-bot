const inventoryCommand = require('../../src/commands/inventory');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const {
  createCharacter,
  createConsumable,
  createEquipment,
  createSkill,
} = require('../helpers/factories');

describe('inventory command', () => {
  let prisma;
  let character;

  beforeEach(() => {
    prisma = createPrismaMock();
    character = createCharacter({
      advancedClass: 'berserker',
      equipment: [createEquipment({ equipped: false })],
      consumables: [createConsumable()],
      skills: [createSkill({ skillKey: 'blood_rage' })],
    });
  });

  test('장비 탭: inventory:tab:equipment 요청을 처리한다', async () => {
    const interaction = createMockInteraction({
      customId: 'inventory:tab:equipment',
    });
    prisma.character.findUnique.mockResolvedValue(character);

    const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('인벤토리');
  });

  test('소모품 탭: inventory:tab:consumable 요청을 처리한다', async () => {
    const interaction = createMockInteraction({
      customId: 'inventory:tab:consumable',
    });
    prisma.character.findUnique.mockResolvedValue(character);

    const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('소비템');
  });

  test('스킬 탭: inventory:tab:skill 요청을 처리한다', async () => {
    const interaction = createMockInteraction({
      customId: 'inventory:tab:skill',
    });
    prisma.character.findUnique.mockResolvedValue(character);

    const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('스킬');
  });

  test('execute: character 컬렉션이 null이어도 인벤토리를 응답한다', async () => {
    const interaction = createMockInteraction();
    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        equipment: null,
        consumables: null,
        skills: null,
      }),
    );

    await inventoryCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('인벤토리');
    expect(payload.components.length).toBeGreaterThan(0);
  });

  test('소모품 탭: character.consumables가 null이어도 처리한다', async () => {
    const interaction = createMockInteraction({
      customId: 'inventory:tab:consumable',
    });
    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        consumables: null,
      }),
    );

    const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('소비템');
  });

  test('스킬 탭: character.skills가 null이어도 처리한다', async () => {
    const interaction = createMockInteraction({
      customId: 'inventory:tab:skill',
    });
    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        advancedClass: 'berserker',
        skills: null,
      }),
    );

    const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('스킬');
  });

  test('탭 전환: 유효하지 않은 탭 파라미터면 에러 메시지를 응답한다', async () => {
    const interaction = createMockInteraction({
      customId: 'inventory:tab:unknown',
    });
    prisma.character.findUnique.mockResolvedValue(character);

    const handled = await inventoryCommand.handleInventoryButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('유효하지 않은 인벤토리 탭');
  });

  test('ActionRow 버튼 수는 행당 5개를 넘지 않는다', () => {
    const equipmentList = Array.from({ length: 8 }, (_, index) => (
      createEquipment({
        id: index + 100,
        equipped: false,
      })
    ));

    const rows = inventoryCommand.createInventoryActionRow(equipmentList);

    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.components.length).toBeLessThanOrEqual(5);
    });
  });
});
