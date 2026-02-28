jest.mock('discord.js', () => {
  class EmbedBuilder {
    constructor() {
      this.data = {};
    }

    setColor(color) {
      this.data.color = color;
      return this;
    }

    setTitle(title) {
      this.data.title = title;
      return this;
    }

    setDescription(description) {
      this.data.description = description;
      return this;
    }

    addFields(...fields) {
      this.data.fields = fields.flat();
      return this;
    }

    setFooter(footer) {
      this.data.footer = footer;
      return this;
    }
  }

  class SlashCommandStringOptionBuilder {
    setName(name) {
      this.name = name;
      return this;
    }

    setDescription(description) {
      this.description = description;
      return this;
    }

    setRequired(required) {
      this.required = required;
      return this;
    }

    setMinLength(minLength) {
      this.minLength = minLength;
      return this;
    }

    setMaxLength(maxLength) {
      this.maxLength = maxLength;
      return this;
    }
  }

  class SlashCommandSubcommandBuilder {
    constructor() {
      this.options = [];
    }

    setName(name) {
      this.name = name;
      return this;
    }

    setDescription(description) {
      this.description = description;
      return this;
    }

    addStringOption(builder) {
      const option = new SlashCommandStringOptionBuilder();
      builder(option);
      this.options.push(option);
      return this;
    }
  }

  class SlashCommandBuilder {
    constructor() {
      this.subcommands = [];
    }

    setName(name) {
      this.name = name;
      return this;
    }

    setDescription(description) {
      this.description = description;
      return this;
    }

    addSubcommand(builder) {
      const subcommand = new SlashCommandSubcommandBuilder();
      builder(subcommand);
      this.subcommands.push(subcommand);
      return this;
    }
  }

  return {
    EmbedBuilder,
    SlashCommandBuilder,
  };
});

const inviteCommand = require('../../src/commands/invite');
const { generateInviteCode } = require('../../src/game/invite-rewards');
const { createMockInteraction } = require('../helpers/discord');
const { createPrismaMock } = require('../helpers/prisma');
const { createCharacter } = require('../helpers/factories');

describe('invite command', () => {
  let prisma;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  test('/invite code: 내 초대 코드를 조회한다', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'code'),
      },
    });

    const character = createCharacter({
      id: 11,
      userId: interaction.user.id,
      name: '초대장인',
    });

    prisma.character.findUnique.mockResolvedValue(character);
    prisma.inviteRecord.count.mockResolvedValue(2);

    await inviteCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].data.description).toContain(generateInviteCode(character.userId));
  });

  test('/invite use: 정상 코드 등록 시 즉시 보상을 지급한다', async () => {
    const inviterUserId = 'friend-user';
    const inviteCode = generateInviteCode(inviterUserId);
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'use'),
        getString: jest.fn((key) => (key === 'code' ? inviteCode : null)),
      },
    });

    const invitee = createCharacter({
      id: 21,
      userId: interaction.user.id,
      name: '신규유저',
      level: 3,
    });

    const inviter = createCharacter({
      id: 77,
      userId: inviterUserId,
      name: '초대왕',
      level: 25,
    });

    prisma.character.findUnique.mockImplementation(async (args) => {
      const userId = args?.where?.userId;
      const id = args?.where?.id;
      if (userId === interaction.user.id) {
        return invitee;
      }
      if (userId === inviterUserId) {
        return inviter;
      }
      if (id === inviter.id) {
        return { level: inviter.level };
      }
      return null;
    });

    prisma.inviteRecord.findUnique.mockResolvedValue(null);
    prisma.inviteRecord.create.mockResolvedValue({
      id: 900,
      inviterId: inviter.id,
      inviteeId: invitee.id,
    });
    prisma.character.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.equipment.create.mockResolvedValue({ id: 501, rarity: 'rare' });

    await inviteCommand.execute(interaction, { prisma });

    expect(prisma.inviteRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviterId: inviter.id,
          inviteeId: invitee.id,
          inviteCode,
        }),
      }),
    );

    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: inviter.id },
      }),
    );
    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invitee.id },
      }),
    );

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].embeds[0].data.title).toContain('등록 완료');
  });

  test('/invite use: 레벨 제한 초과 시 코드를 사용할 수 없다', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn(() => 'use'),
        getString: jest.fn(() => generateInviteCode('friend-user')),
      },
    });

    prisma.character.findUnique.mockResolvedValue(
      createCharacter({
        userId: interaction.user.id,
        level: 6,
      }),
    );

    await inviteCommand.execute(interaction, { prisma });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply.mock.calls[0][0].content).toContain('Lv.5 이하');
    expect(prisma.inviteRecord.create).not.toHaveBeenCalled();
  });
});
