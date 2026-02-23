const premiumCommand = require('../../src/commands/premium');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const { createCharacter } = require('../helpers/factories');

describe('premium command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-22T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('/premium 실행 시 상태 임베드와 자동전투 토글 버튼을 표시한다', async () => {
    const interaction = createMockInteraction();
    const character = createCharacter({
      id: 30,
      userId: interaction.user.id,
      name: '프리미엄러',
    });
    const endDate = new Date('2026-03-24T03:00:00.000Z');

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.premiumSubscription.findUnique.mockResolvedValue({
      userId: interaction.user.id,
      planId: 'premium_monthly_999',
      startDate: new Date('2026-02-22T03:00:00.000Z'),
      endDate,
      autoFight: true,
      autoPotion: false,
      autoConsumable: false,
    });

    await premiumCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].data.title).toContain('Premium Pass');
    expect(payload.embeds[0].data.description).toContain('자동전투: ON');
    expect(payload.embeds[0].data.description).toContain('자동 물약: OFF');
    expect(payload.embeds[0].data.description).toContain('자동 소비템: OFF');

    const row = payload.components[0].toJSON();
    const customIds = row.components.map((component) => component.custom_id);
    expect(customIds).toEqual([
      'premium:toggle:autoFight',
      'premium:toggle:autoPotion',
      'premium:toggle:autoConsumable',
      'village:home',
    ]);
  });

  test('프리미엄 토글 버튼 클릭 시 설정 값을 반전하여 갱신한다', async () => {
    const interaction = createMockInteraction({
      customId: 'premium:toggle:autoFight',
    });
    const character = createCharacter({
      id: 30,
      userId: interaction.user.id,
      name: '토글러',
    });
    const subscription = {
      userId: interaction.user.id,
      planId: 'premium_monthly_999',
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      autoFight: false,
      autoPotion: false,
      autoConsumable: false,
    };

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.premiumSubscription.findUnique.mockResolvedValue(subscription);
    prisma.premiumSubscription.update.mockResolvedValue({
      ...subscription,
      autoFight: true,
    });

    const handled = await premiumCommand.handlePremiumButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(prisma.premiumSubscription.update).toHaveBeenCalledWith({
      where: {
        userId: interaction.user.id,
      },
      data: {
        autoFight: true,
      },
    });
    expect(interaction.update).toHaveBeenCalledTimes(1);
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.description).toContain('자동전투: ON');
  });

  test('비활성 프리미엄 상태에서 토글 버튼 클릭 시 안내 메시지를 반환한다', async () => {
    const interaction = createMockInteraction({
      customId: 'premium:toggle:autoPotion',
    });
    const character = createCharacter({
      id: 30,
      userId: interaction.user.id,
      name: '비활성러',
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.premiumSubscription.findUnique.mockResolvedValue({
      userId: interaction.user.id,
      planId: 'premium_monthly_999',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      autoFight: false,
      autoPotion: true,
      autoConsumable: false,
    });

    const handled = await premiumCommand.handlePremiumButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(prisma.premiumSubscription.update).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '활성 Premium Pass가 없습니다.',
      ephemeral: true,
    });
  });
});
