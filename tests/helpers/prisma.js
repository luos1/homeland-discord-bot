const { mockDeep, mockReset } = require('jest-mock-extended');

function createPrismaMock() {
  return mockDeep();
}

function resetPrismaMock(prisma) {
  mockReset(prisma);
}

function createTransactionMock() {
  return mockDeep();
}

function mockPrismaTransaction(prisma, tx) {
  prisma.$transaction.mockImplementation(async (handler) => handler(tx));
}

module.exports = {
  createPrismaMock,
  resetPrismaMock,
  createTransactionMock,
  mockPrismaTransaction,
};
