/**
 * 프리미엄 구독 티어
 * 
 * - 3단계 구독 (Bronze, Silver, Gold)
 * - 각 티어별 혜택
 * - 수익화 핵심
 */

const PREMIUM_TIERS = {
  bronze: {
    id: 'bronze',
    name: '브론즈',
    emoji: '🥉',
    price: 5, // $5/월
    benefits: {
      xpBonus: 0.25, // +25%
      goldBonus: 0.25, // +25%
      autoB attleLimit: 10, // 하루 10회
      dailyGems: 10, // 매일 10젬
      specialEmoji: true,
      adFree: true
    },
    description: [
      '📈 경험치 +25%',
      '💰 골드 +25%',
      '⚡ 오토 배틀 10회/일',
      '💎 매일 젬 10개',
      '🎨 특별 이모지',
      '📺 광고 제거'
    ]
  },
  silver: {
    id: 'silver',
    name: '실버',
    emoji: '🥈',
    price: 10, // $10/월
    benefits: {
      xpBonus: 0.5, // +50%
      goldBonus: 0.5, // +50%
      autoBattleLimit: 30, // 하루 30회
      dailyGems: 30, // 매일 30젬
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost'], // 전용 스킬
      nameColor: '🌟',
      prioritySupport: true
    },
    description: [
      '📈 경험치 +50%',
      '💰 골드 +50%',
      '⚡ 오토 배틀 30회/일',
      '💎 매일 젬 30개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '✨ 전용 스킬 2종',
      '🌟 특별 닉네임 색상',
      '🎫 우선 지원'
    ]
  },
  gold: {
    id: 'gold',
    name: '골드',
    emoji: '🥇',
    price: 20, // $20/월
    benefits: {
      xpBonus: 1.0, // +100% (2배!)
      goldBonus: 1.0, // +100% (2배!)
      autoBattleLimit: -1, // 무제한
      dailyGems: 100, // 매일 100젬
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost', 'premium_ultimate'],
      nameColor: '👑',
      prioritySupport: true,
      exclusiveContent: true, // 전용 던전
      weeklyLegendaryBox: true, // 주간 전설 상자
      tradeFeeDiscount: 0.5 // 거래 수수료 50% 할인
    },
    description: [
      '📈 경험치 +100% (2배!)',
      '💰 골드 +100% (2배!)',
      '⚡ 오토 배틀 무제한',
      '💎 매일 젬 100개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '✨ 전용 스킬 3종',
      '👑 골드 닉네임',
      '🎫 VIP 지원',
      '🏰 전용 던전 입장',
      '🎁 주간 전설 상자',
      '💸 거래 수수료 50% 할인'
    ]
  }
};

/**
 * 티어 조회
 */
function getTier(tierId) {
  return PREMIUM_TIERS[tierId] || null;
}

/**
 * 모든 티어 목록
 */
function getAllTiers() {
  return Object.values(PREMIUM_TIERS);
}

/**
 * 구독 혜택 적용
 */
function applyPremiumBenefits(character, tier) {
  if (!tier) {
    return {
      xpMultiplier: 1.0,
      goldMultiplier: 1.0,
      autoBattleLimit: 0,
      dailyGems: 0
    };
  }
  
  const tierData = PREMIUM_TIERS[tier];
  
  if (!tierData) {
    return {
      xpMultiplier: 1.0,
      goldMultiplier: 1.0,
      autoBattleLimit: 0,
      dailyGems: 0
    };
  }
  
  return {
    xpMultiplier: 1 + tierData.benefits.xpBonus,
    goldMultiplier: 1 + tierData.benefits.goldBonus,
    autoBattleLimit: tierData.benefits.autoBattleLimit,
    dailyGems: tierData.benefits.dailyGems,
    exclusiveSkills: tierData.benefits.exclusiveSkills || [],
    nameColor: tierData.benefits.nameColor,
    exclusiveContent: tierData.benefits.exclusiveContent || false,
    tradeFeeDiscount: tierData.benefits.tradeFeeDiscount || 0
  };
}

/**
 * 구독 가격 계산 (월간/연간)
 */
function calculatePrice(tierId, period = 'monthly') {
  const tier = PREMIUM_TIERS[tierId];
  
  if (!tier) return 0;
  
  if (period === 'monthly') {
    return tier.price;
  }
  
  if (period === 'yearly') {
    // 연간 구독 시 20% 할인
    return Math.floor(tier.price * 12 * 0.8);
  }
  
  return tier.price;
}

/**
 * 예상 수익 계산
 */
function calculateRevenue(subscriptions) {
  let total = 0;
  
  for (const [tier, count] of Object.entries(subscriptions)) {
    const tierData = PREMIUM_TIERS[tier];
    if (tierData) {
      total += tierData.price * count;
    }
  }
  
  return total;
}

/**
 * 목표 달성 시뮬레이션
 */
function simulateRevenue(target = 2000) {
  // $2,000/월 목표 달성 시나리오
  const scenarios = [
    {
      name: '브론즈 중심',
      bronze: 300, // 300명 x $5 = $1,500
      silver: 40,  // 40명 x $10 = $400
      gold: 5,     // 5명 x $20 = $100
      total: 1500 + 400 + 100,
      users: 345
    },
    {
      name: '실버 중심',
      bronze: 100,
      silver: 100, // 100명 x $10 = $1,000
      gold: 30,    // 30명 x $20 = $600
      total: 500 + 1000 + 600,
      users: 230
    },
    {
      name: '골드 중심',
      bronze: 50,
      silver: 50,
      gold: 70,    // 70명 x $20 = $1,400
      total: 250 + 500 + 1400,
      users: 170
    },
    {
      name: '균형',
      bronze: 150,
      silver: 60,
      gold: 15,
      total: 750 + 600 + 300,
      users: 225
    }
  ];
  
  return scenarios;
}

module.exports = {
  PREMIUM_TIERS,
  getTier,
  getAllTiers,
  applyPremiumBenefits,
  calculatePrice,
  calculateRevenue,
  simulateRevenue
};
