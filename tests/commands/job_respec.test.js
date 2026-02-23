const jobRespecCommand = require('../../src/commands/job_respec');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const { createCharacter } = require('../helpers/factories');

describe('job respec command handlers', () => {
  let prisma;
  let tx;

  beforeEach(() => {
    prisma = createPrismaMock();
    tx = createTransactionMock();
    mockPrismaTransaction(prisma, tx);
    jest.clearAllMocks();
  });

  function mockDemandBasics() {
    prisma.jobRespecDemand.findUnique.mockResolvedValue({ multiplier: 1 });
    prisma.jobRespecHistory.findMany.mockResolvedValue([]);
    prisma.jobRespecDemand.upsert.mockResolvedValue({ id: 1 });
  }

  test('직업 관리 버튼(village:job_manage) 클릭 시 관리 메뉴를 표시한다', async () => {
    const interaction = createMockInteraction({
      customId: jobRespecCommand.VILLAGE_JOB_MANAGE_BUTTON_ID,
    });

    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        id: 10,
        userId: interaction.user.id,
        class: '전사',
        level: 12,
        gold: 9000,
        productionClass: 'blacksmith',
        productionLevel: 4,
        gatherSessions: [],
        craftingSessions: [],
      }),
    );
    mockDemandBasics();

    const handled = await jobRespecCommand.handleJobManageButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.update).toHaveBeenCalledTimes(1);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('직업 관리');

    const row = payload.components[0];
    const buttonIds = row.components.map((button) => button.data.custom_id);

    expect(buttonIds).toContain(jobRespecCommand.COMBAT_RESPEC_BUTTON_ID);
    expect(buttonIds).toContain(jobRespecCommand.PRODUCTION_RESPEC_BUTTON_ID);
  });

  test('전투 중에는 전투 재전직 선택을 열 수 없다', async () => {
    const interaction = createMockInteraction({
      customId: jobRespecCommand.COMBAT_RESPEC_BUTTON_ID,
    });

    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        userId: interaction.user.id,
        combatSession: { id: 'combat-1' },
        gatherSessions: [],
        craftingSessions: [],
      }),
    );

    const handled = await jobRespecCommand.handleCombatRespecButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('전투 중');
  });

  test('재전직 확인 실행 시 직업 변경/골드 차감/이력 저장을 수행한다', async () => {
    const interaction = createMockInteraction({
      customId: 'job_respec:execute:combat:ranger',
    });

    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        id: 30,
        userId: interaction.user.id,
        class: '전사',
        level: 22,
        gold: 12000,
        productionClass: 'blacksmith',
        gatherSessions: [],
        craftingSessions: [],
        combatSession: null,
      }),
    );
    mockDemandBasics();

    tx.character.update.mockResolvedValue({ id: 30 });
    tx.jobRespecHistory.create.mockResolvedValue({ id: 101 });

    const handled = await jobRespecCommand.handleRespecConfirmButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: {
        class: '궁수',
        gold: {
          decrement: 5000,
        },
      },
    });
    expect(tx.jobRespecHistory.create).toHaveBeenCalledWith({
      data: {
        characterId: 30,
        jobType: 'combat',
        fromClass: 'warrior',
        toClass: 'ranger',
        cost: 5000,
      },
    });
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.update.mock.calls[0][0].embeds[0].data.title).toContain('재전직 완료');
  });

  test('골드가 부족하면 재전직 실행을 거부한다', async () => {
    const interaction = createMockInteraction({
      customId: 'job_respec:execute:combat:ranger',
    });

    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        id: 31,
        userId: interaction.user.id,
        class: '전사',
        gold: 1000,
        gatherSessions: [],
        craftingSessions: [],
        combatSession: null,
      }),
    );
    mockDemandBasics();

    const handled = await jobRespecCommand.handleRespecConfirmButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('골드가 부족');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('현재 직업과 동일한 직업 선택은 거부한다', async () => {
    const interaction = createMockInteraction({
      customId: 'job_respec:execute:combat:warrior',
    });

    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        id: 32,
        userId: interaction.user.id,
        class: '전사',
        gold: 99999,
        gatherSessions: [],
        craftingSessions: [],
        combatSession: null,
      }),
    );
    mockDemandBasics();

    const handled = await jobRespecCommand.handleRespecConfirmButton(interaction, { prisma });

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('동일한 직업');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
