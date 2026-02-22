jest.mock('../../src/game/session-cleanup', () => ({
  cleanupOldSessions: jest.fn().mockResolvedValue(0),
}));

const createCommand = require('../../src/commands/create');
const profileCommand = require('../../src/commands/profile');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const { createCharacter, createEquipment } = require('../helpers/factories');

describe('profile/create command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('캐릭터 생성: class/name 입력으로 새 캐릭터를 만든다', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: jest.fn((key) => {
          if (key === 'class') {
            return 'warrior';
          }
          if (key === 'name') {
            return '테스트@닉';
          }
          return null;
        }),
      },
    });

    prisma.character.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 1 });
    prisma.character.create.mockResolvedValue(
      createCharacter({
        userId: interaction.user.id,
        name: '테스트닉',
        class: '전사',
      }),
    );

    await createCommand.execute(interaction, { prisma });

    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '테스트닉',
          class: '전사',
        }),
      }),
    );

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.components).toHaveLength(1);
  });

  test('프로필 조회: 캐릭터가 있으면 임베드와 버튼을 반환한다', async () => {
    const interaction = createMockInteraction();
    const character = createCharacter({
      userId: interaction.user.id,
      equipment: [createEquipment()],
      skills: [],
    });

    prisma.character.findUnique.mockResolvedValue(character);

    await profileCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.components).toHaveLength(2);
    expect(payload.embeds[0].data.title).toContain(character.name);
  });
});
