const PREMIUM_PLAN_ID = 'premium_monthly_999';
const PREMIUM_PLAN = {
  id: PREMIUM_PLAN_ID,
  label: 'Premium Pass Monthly',
  monthlyPriceUsd: 9.99,
  durationDays: 30,
  xpMultiplier: 1.2,
  goldMultiplier: 1.15,
  dailyGemBonus: 10,
  skillSlotBonus: 1, // 스킬 슬롯 +1 (기본 3 → 4)
  autoFight: true, // 자동 사냥 활성화
};

const PREMIUM_STRIPE_REQUIRED_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PREMIUM_PRICE_ID',
  'STRIPE_SUCCESS_URL',
  'STRIPE_CANCEL_URL',
];

function isPremiumSubscriptionActive(subscription, now = new Date()) {
  if (!subscription) {
    return false;
  }

  const startDate = subscription.startDate ? new Date(subscription.startDate) : null;
  const endDate = subscription.endDate ? new Date(subscription.endDate) : null;

  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false;
  }

  return startDate <= now && endDate >= now;
}

function resolvePremiumBenefits(subscription, now = new Date()) {
  const active = isPremiumSubscriptionActive(subscription, now);

  if (!active) {
    return {
      active: false,
      xpMultiplier: 1,
      goldMultiplier: 1,
      dailyGemBonus: 0,
      skillSlotBonus: 0,
      autoFight: false,
    };
  }

  return {
    active: true,
    xpMultiplier: PREMIUM_PLAN.xpMultiplier,
    goldMultiplier: PREMIUM_PLAN.goldMultiplier,
    dailyGemBonus: PREMIUM_PLAN.dailyGemBonus,
    skillSlotBonus: PREMIUM_PLAN.skillSlotBonus,
    autoFight: PREMIUM_PLAN.autoFight,
  };
}

function buildPremiumPeriod(startDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + PREMIUM_PLAN.durationDays * 24 * 60 * 60 * 1000);

  return {
    startDate: start,
    endDate: end,
  };
}

function formatPremiumPrice() {
  return `$${PREMIUM_PLAN.monthlyPriceUsd.toFixed(2)}`;
}

function getStripePremiumReadiness(env = process.env) {
  const missingKeys = PREMIUM_STRIPE_REQUIRED_ENV.filter((key) => !env[key]);

  return {
    ready: missingKeys.length === 0,
    missingKeys,
  };
}

module.exports = {
  PREMIUM_PLAN_ID,
  PREMIUM_PLAN,
  PREMIUM_STRIPE_REQUIRED_ENV,
  isPremiumSubscriptionActive,
  resolvePremiumBenefits,
  buildPremiumPeriod,
  formatPremiumPrice,
  getStripePremiumReadiness,
};
