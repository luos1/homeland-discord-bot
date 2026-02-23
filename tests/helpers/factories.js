function createCharacter(overrides = {}) {
  return {
    id: 1,
    userId: 'user-1',
    name: '테스터',
    class: '전사',
    level: 1,
    xp: 0,
    gold: 100,
    gems: 0,
    hp: 120,
    maxHp: 120,
    mana: 36,
    maxMana: 36,
    attack: 12,
    defense: 8,
    advancedClass: null,
    productionClass: null,
    advancedProductionClass: null,
    productionLevel: 1,
    productionXp: 0,
    warriorMastery: 0,
    rangerMastery: 0,
    mageMastery: 0,
    gathererMastery: 0,
    blacksmithMastery: 0,
    alchemistMastery: 0,
    winStreak: 0,
    maxWinStreak: 0,
    combatSession: null,
    equipment: [],
    consumables: [],
    skills: [],
    resources: [],
    marketListings: [],
    premiumSubscription: null,
    ...overrides,
  };
}

function createEquipment(overrides = {}) {
  return {
    id: 11,
    characterId: 1,
    name: '훈련용 검',
    type: 'weapon',
    rarity: 'common',
    attack: 5,
    defense: 2,
    hp: 0,
    mana: 0,
    effect: null,
    equipped: false,
    upgradeLevel: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createConsumable(overrides = {}) {
  return {
    id: 21,
    characterId: 1,
    name: '체력 포션',
    effect: 'heal_hp',
    power: 30,
    duration: 0,
    quantity: 2,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createSkill(overrides = {}) {
  return {
    id: 31,
    characterId: 1,
    skillKey: 'blood_rage',
    skillLevel: 1,
    equipped: false,
    level: 1,
    ...overrides,
  };
}

function createResource(overrides = {}) {
  return {
    id: 41,
    characterId: 1,
    type: 'wood',
    name: '목재',
    quantity: 10,
    ...overrides,
  };
}

function createMarketListing(overrides = {}) {
  return {
    id: 51,
    sellerId: 2,
    buyerId: null,
    itemType: 'resource',
    itemKey: 'wood',
    itemName: '목재',
    quantity: 5,
    pricePerUnit: 50,
    totalPrice: 250,
    itemData: null,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    soldAt: null,
    ...overrides,
  };
}

module.exports = {
  createCharacter,
  createEquipment,
  createConsumable,
  createSkill,
  createResource,
  createMarketListing,
};
