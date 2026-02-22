const attendanceCommand = require('../../src/commands/attendance');
const { createMockInteraction } = require('../helpers/discord');
const {
  createPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
} = require('../helpers/prisma');
const { createCharacter } = require('../helpers/factories');

describe('attendance command', () => {
  let prisma;
  let tx;

  beforeEach(() => {
    prisma = createPrismaMock();
    tx = createTransactionMock();
    mockPrismaTransaction(prisma, tx);
    jest.useFakeTimers().setSystemTime(new Date('2026-02-22T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('첫 출석: 1일 보상 100G를 지급하고 출석 기록을 생성한다', async () => {
    const interaction = createMockInteraction();
    const character = createCharacter({
      id: 10,
      userId: interaction.user.id,
      name: '출석러',
      level: 5,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.attendanceRecord.findFirst.mockResolvedValue(null);
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { characterId: character.id, date: '2026-02-22', streak: 1, claimed: true },
    ]);
    prisma.attendanceRecord.findUnique.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-22',
      streak: 1,
      claimed: true,
    });
    prisma.attendanceRecord.aggregate.mockResolvedValue({ _max: { streak: 1 } });

    await attendanceCommand.execute(interaction, { prisma });

    expect(tx.attendanceRecord.create).toHaveBeenCalledWith({
      data: {
        characterId: character.id,
        date: '2026-02-22',
        streak: 1,
        claimed: true,
      },
    });
    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: character.id },
      data: {
        gold: {
          increment: 100,
        },
      },
    });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].data.title).toContain('출석 체크 완료');
    expect(payload.embeds[0].data.description).toContain('골드 +100G');
  });

  test('중복 출석: 같은 날 재요청 시 추가 보상이 지급되지 않는다', async () => {
    const interaction = createMockInteraction();
    const character = createCharacter({
      id: 11,
      userId: interaction.user.id,
      level: 12,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.attendanceRecord.findFirst.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-22',
      streak: 5,
      claimed: true,
    });
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { characterId: character.id, date: '2026-02-22', streak: 5, claimed: true },
    ]);
    prisma.attendanceRecord.findUnique.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-22',
      streak: 5,
      claimed: true,
    });
    prisma.attendanceRecord.aggregate.mockResolvedValue({ _max: { streak: 7 } });

    await attendanceCommand.execute(interaction, { prisma });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.title).toContain('출석 캘린더');
    expect(payload.embeds[0].data.description).toContain('이미 완료');
  });

  test('3일차 출석: 300G와 출석 포션을 지급한다', async () => {
    const interaction = createMockInteraction();
    const character = createCharacter({
      id: 12,
      userId: interaction.user.id,
      level: 8,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.attendanceRecord.findFirst.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-21',
      streak: 2,
      claimed: true,
    });
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { characterId: character.id, date: '2026-02-20', streak: 1, claimed: true },
      { characterId: character.id, date: '2026-02-21', streak: 2, claimed: true },
      { characterId: character.id, date: '2026-02-22', streak: 3, claimed: true },
    ]);
    prisma.attendanceRecord.findUnique.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-22',
      streak: 3,
      claimed: true,
    });
    prisma.attendanceRecord.aggregate.mockResolvedValue({ _max: { streak: 3 } });

    await attendanceCommand.execute(interaction, { prisma });

    expect(tx.character.update).toHaveBeenCalledWith({
      where: { id: character.id },
      data: {
        gold: {
          increment: 300,
        },
      },
    });
    expect(tx.consumable.upsert).toHaveBeenCalledWith({
      where: {
        characterId_type_effect: {
          characterId: character.id,
          type: 'attendance_potion',
          effect: 'heal_hp',
        },
      },
      update: {
        quantity: {
          increment: 1,
        },
      },
      create: {
        characterId: character.id,
        name: '출석 포션',
        type: 'attendance_potion',
        effect: 'heal_hp',
        power: 60,
        duration: null,
        quantity: 1,
      },
    });

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.description).toContain('출석 포션');
  });

  test('결석 후 출석: 스트릭이 1로 리셋된다', async () => {
    const interaction = createMockInteraction();
    const character = createCharacter({
      id: 13,
      userId: interaction.user.id,
      level: 15,
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.attendanceRecord.findFirst.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-20',
      streak: 10,
      claimed: true,
    });
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { characterId: character.id, date: '2026-02-22', streak: 1, claimed: true },
    ]);
    prisma.attendanceRecord.findUnique.mockResolvedValue({
      characterId: character.id,
      date: '2026-02-22',
      streak: 1,
      claimed: true,
    });
    prisma.attendanceRecord.aggregate.mockResolvedValue({ _max: { streak: 10 } });

    await attendanceCommand.execute(interaction, { prisma });

    expect(tx.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          streak: 1,
        }),
      }),
    );

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].data.description).toContain('다시 시작');
  });
});
