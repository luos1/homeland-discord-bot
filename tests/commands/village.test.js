const villageCommand = require('../../src/commands/village');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');

describe('village command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('/village 실행 시 허브 임베드와 카테고리 버튼을 표시한다', async () => {
    const interaction = createMockInteraction();

    prisma.character.findUnique.mockResolvedValue({
      id: 1,
      name: '허브유저',
      class: '전사',
      level: 12,
      gold: 3456,
      gems: 25,
    });

    await villageCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];

    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].data.title).toContain('마을 허브');
    expect(payload.components).toHaveLength(2);
  });

  test('마을 메뉴 버튼(menu:daily) 클릭 시 일일 메뉴로 전환한다', async () => {
    const interaction = createMockInteraction({
      customId: 'village:menu:daily',
    });

    prisma.character.findUnique.mockResolvedValue(null);

    const handled = await villageCommand.handleVillageButton(interaction, {
      prisma,
      client: { commands: new Map() },
    });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('일일 메뉴');
  });

  test('마을에서 Daily Quest 열기(open:daily) 시 명령어 결과에 네비게이션 버튼을 추가한다', async () => {
    const interaction = createMockInteraction({
      customId: 'village:open:daily',
    });

    prisma.character.findUnique.mockResolvedValue({
      id: 10,
      name: '일일유저',
      class: '전사',
      level: 4,
      gold: 100,
      gems: 1,
    });

    const dailyExecute = jest.fn(async (proxyInteraction) => {
      await proxyInteraction.reply({
        embeds: [{ data: { title: '🎁 Daily Quest' } }],
      });
    });

    const handled = await villageCommand.handleVillageButton(interaction, {
      prisma,
      client: {
        commands: new Map([
          ['daily', { execute: dailyExecute }],
        ]),
      },
    });

    expect(handled).toBe(true);
    expect(dailyExecute).toHaveBeenCalledTimes(1);
    expect(interaction.update).toHaveBeenCalledTimes(1);

    const payload = interaction.update.mock.calls[0][0];
    const lastRow = payload.components[payload.components.length - 1];
    expect(lastRow.components[0].data.custom_id).toBe('village:home');
    expect(lastRow.components[1].data.custom_id).toBe('village:back:daily');
  });
});
