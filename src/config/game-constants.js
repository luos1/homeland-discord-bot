// ---------------------------------------------------------------------------
// Game-wide magic numbers, grouped by domain.
// Import from here instead of hard-coding values in business logic.
// ---------------------------------------------------------------------------

const COMBAT = {
  // Player attack
  PLAYER_CRIT_CHANCE: 0.15,
  PLAYER_CRIT_MULTIPLIER: 1.65,

  // Enemy attack
  ENEMY_CRIT_CHANCE: 0.08,
  ENEMY_CRIT_MULTIPLIER: 1.5,

  // Damage variance: final = base * (MIN + random * RANGE)
  DAMAGE_VARIANCE_MIN: 0.85,
  DAMAGE_VARIANCE_RANGE: 0.3,

  // Defend action: incoming damage multiplied by this
  DEFEND_DAMAGE_MULTIPLIER: 0.45,

  // Flee action
  FLEE_CHANCE: 0.45,
  FLEE_RECOVERY_RATIO: 0.5,

  // Base potion (per-session free potions)
  POTION_HEAL_MIN: 20,
  POTION_HEAL_RATIO: 0.35,
  DEFAULT_POTIONS_PER_SESSION: 3,

  // Mana recovery after victory
  MANA_RECOVERY_RATIO: 0.3,

  // UI thresholds
  LOW_HP_WARNING_RATIO: 0.3,
  LOW_MONSTER_HP_RATIO: 0.2,

  // Hidden dungeon discovery (boss clear, zone1)
  HIDDEN_DUNGEON_CHANCE: 0.01,

  // Button label truncation
  BUTTON_LABEL_MAX_LENGTH: 40,

  // Max skills shown in combat UI
  MAX_COMBAT_SKILLS: 5,
};

const SHOP = {
  // Potion prices
  HEALTH_POTION_PRICE: 50,
  MANA_POTION_PRICE: 40,

  // Potion power values (percentage-based heal)
  HEALTH_POTION_POWER: 35,
  MANA_POTION_POWER: 50,

  // Equipment gacha prices by tier
  EQUIPMENT_PRICES: {
    common: 100,
    uncommon: 300,
    rare: 800,
    epic: 2000,
    legendary: 5000,
  },

  // Equipment sell-back ratio (fraction of buy price)
  SELL_RATIO: 0.3,

  // Equipment upgrade
  UPGRADE_BASE_PRICE: 200,
  UPGRADE_SUCCESS_RATE: 0.65,
  MAX_UPGRADE_LEVEL: 5,
  UPGRADE_STAT_BONUS_RATE: 0.1,
  UPGRADE_BONUS_FLAT: 1,

  // Upgrade cost rarity multipliers
  UPGRADE_RARITY_MULTIPLIERS: {
    common: 1,
    uncommon: 1.5,
    rare: 2,
    epic: 3,
    legendary: 5,
  },

  // Sell price upgrade bonus per level
  SELL_UPGRADE_BONUS_PER_LEVEL: 100,
};

const MARKET = {
  // Resource order-book limits
  MAX_PRICE_PER_UNIT: 100000,
  ORDERBOOK_DEPTH: 5,
  RECENT_TRADE_LIMIT: 5,
  MAX_SELECT_OPTIONS: 25,

  // Equipment marketplace
  EQUIPMENT_MAX_PRICE: 100000000,

  // NPC trader sentinel value
  NPC_TRADER_ID: 0,
};

const AUCTION = {
  FEE_RATE: 0.05,
  EXTENSION_TRIGGER_MINUTES: 5,
  EXTENSION_MINUTES: 5,
  MIN_START_PRICE: 100,
  MAX_START_PRICE: 1_000_000_000,
  MIN_INCREMENT: 100,
  INCREMENT_RATE: 0.02,
  ALLOWED_DURATIONS_HOURS: Object.freeze([1, 6, 24]),
  RECENT_BIDS_DISPLAY: 5,
};

const ECONOMY = {
  // Global market fee & combat gold tuning
  MARKET_FEE_RATE: 0.05,
  COMBAT_GOLD_SOURCE_MULTIPLIER: 0.88,
  PRICE_LOOKBACK_HOURS: 24,

  // NPC resource base prices by tier
  RESOURCE_BASE_PRICE_BY_TIER: {
    1: 24,
    2: 72,
    3: 180,
    4: 420,
  },

  // NPC supply/demand equilibrium targets
  TARGET_SUPPLY_BY_TIER: {
    1: 140,
    2: 90,
    3: 50,
    4: 24,
  },
  TARGET_DEMAND_BY_TIER: {
    1: 90,
    2: 60,
    3: 35,
    4: 16,
  },

  // NPC price adjustment multipliers
  SUPPLY_PRESSURE_CLAMP: 1.4,
  SUPPLY_WEIGHT: 0.36,
  DEMAND_WEIGHT: 0.24,

  // Circuit-breaker bounds (relative to anchor price)
  ANCHOR_MIN_RATIO: 0.8,
  ANCHOR_MAX_RATIO: 1.2,

  // Step-change bounds (relative to previous price)
  STEP_LOWER_RATIO: 0.88,
  STEP_UPPER_RATIO: 1.12,

  // Absolute price floor/ceiling (relative to base price)
  ABSOLUTE_FLOOR_RATIO: 0.55,
  ABSOLUTE_CEIL_RATIO: 1.65,

  // Trend detection threshold
  TREND_THRESHOLD: 0.06,

  // Repair cost components
  REPAIR_REWARD_RATIO: 0.2,
  REPAIR_DURABILITY_RATIO: 0.45,
  REPAIR_LEVEL_RATIO: 0.65,
  REPAIR_DEFEAT_MULTIPLIER: 1.3,

  // Death penalty
  DEATH_PENALTY_PERCENT: 0.05,
  DEATH_PENALTY_CAP_RATIO: 0.2,
  DEATH_PENALTY_LEVEL_FACTOR: 4,
  DEATH_PENALTY_FLAT: 14,
};

module.exports = {
  COMBAT,
  SHOP,
  MARKET,
  AUCTION,
  ECONOMY,
};
