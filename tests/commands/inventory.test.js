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
});
