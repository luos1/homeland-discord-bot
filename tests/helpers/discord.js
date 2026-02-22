function createMockInteraction(overrides = {}) {
  return {
    user: {
      id: 'user-1',
      username: 'tester',
    },
    customId: '',
    values: [],
    options: {
      getString: jest.fn(() => null),
    },
    fields: {
      getTextInputValue: jest.fn(() => ''),
    },
    reply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

module.exports = {
  createMockInteraction,
};
