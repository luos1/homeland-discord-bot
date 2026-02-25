/**
 * 프리미엄 구독 티어 (7단계)
 * 
 * - 기존 3단계 (Bronze, Silver, Gold) 유지
 * - 신규 2단계 (Diamond, Elite) 추가
 * - 일회성 상품 (Starter Pack, Founder Pack) 추가
 * - 수익화 핵심
 */

const PREMIUM_TIERS = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    emoji: '📱',
    price: 2.99, // $2.99 일회성
    type: 'one_time',
    benefits: {
      xpBonus: 1.0, // +100% 48시간
      goldBonus: 0.5, // +50% 48시간
      duration: 48 * 60 * 60, // 48시간 (초)
      immediateGold: 1000,
      immediateGems: 50,
      rareWeaponBox: 1
    },
    description: [
      '⏱️ 48시간 부스트',
      '📈 경험치 +100% (48h)',
      '💰 골드 +50% (48h)',
      '🪙 골드 1,000개 즉시 지급',
      '💎 젬 50개 즉시 지급',
      '🎁 레어 무기 상자 x1'
    ]
  },
  bronze: {
    id: 'bronze',
    name: '브론즈',
    emoji: '🥉',
    price: 4.99, // $4.99/월
    type: 'subscription',
    benefits: {
      xpBonus: 0.2, // +20%
      goldBonus: 0.15, // +15%
      autoBattleLimit: 10, // 하루 10회
      dailyGems: 10, // 매일 10젬
      specialEmoji: true,
      adFree: true,
      specialTitles: 1
    },
    description: [
      '📈 경험치 +20%',
      '💰 골드 +15%',
      '⚡ 오토 배틀 10회/일',
      '💎 매일 젬 10개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '🏷️ 특별 칭호 1개'
    ]
  },
  silver: {
    id: 'silver',
    name: '실버',
    emoji: '🥈',
    price: 9.99, // $9.99/월
    type: 'subscription',
    benefits: {
      xpBonus: 0.4, // +40%
      goldBonus: 0.3, // +30%
      autoBattleLimit: 30, // 하루 30회
      dailyGems: 25, // 매일 25젬
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost'],
      nameColor: '🌟',
      prioritySupport: true,
      specialTitles: 3,
      guildSlotBonus: 5,
      shopAccess: true
    },
    description: [
      '📈 경험치 +40%',
      '💰 골드 +30%',
      '⚡ 오토 배틀 30회/일',
      '💎 매일 젬 25개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '✨ 전용 스킬 2종',
      '🌟 특별 닉네임 색상',
      '🎫 우선 지원',
      '🏷️ 특별 칭호 3개',
      '👥 길드 슬롯 +5',
      '🏪 전용 상점 접근'
    ]
  },
  gold: {
    id: 'gold',
    name: '골드',
    emoji: '🥇',
    price: 19.99, // $19.99/월
    type: 'subscription',
    benefits: {
      xpBonus: 0.6, // +60%
      goldBonus: 0.5, // +50%
      autoBattleLimit: -1, // 무제한
      dailyGems: 50, // 매일 50젬
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost', 'premium_ultimate'],
      nameColor: '👑',
      prioritySupport: true,
      exclusiveContent: true,
      weeklyLegendaryBox: true,
      tradeFeeDiscount: 0.5,
      specialTitles: -1, // 무제한
      guildSlotBonus: 10,
      raidAccess: true
    },
    description: [
      '📈 경험치 +60%',
      '💰 골드 +50%',
      '⚡ 오토 배틀 무제한',
      '💎 매일 젬 50개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '✨ 전용 스킬 3종',
      '👑 골드 닉네임',
      '🎫 VIP 지원',
      '🏰 전용 레이드 입장',
      '🎁 주간 전설 상자',
      '💸 거래 수수료 50% 할인',
      '🏷️ 특별 칭호 무제한',
      '👥 길드 슬롯 +10'
    ]
  },
  diamond: {
    id: 'diamond',
    name: '다이아몬드',
    emoji: '💎',
    price: 34.99, // $34.99/월
    type: 'subscription',
    benefits: {
      xpBonus: 1.0, // +100%
      goldBonus: 0.75, // +75%
      autoBattleLimit: -1,
      dailyGems: 100,
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost', 'premium_ultimate', 'premium_divine'],
      nameColor: '💎',
      prioritySupport: true,
      exclusiveContent: true,
      weeklyLegendaryBox: true,
      tradeFeeDiscount: 0.5,
      specialTitles: -1,
      guildSlotBonus: 15,
      raidAccess: true,
      customTitle: true, // 커스텀 칭호 제작
      pvpSeasonRewardMultiplier: 2, // PvP 시즌 보상 2배
      exclusiveSkinsMonthly: 3, // 독점 스킨 3개/월
      vipSupport: true
    },
    description: [
      '📈 경험치 +100% (2배!)',
      '💰 골드 +75%',
      '⚡ 오토 배틀 무제한',
      '💎 매일 젬 100개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '✨ 전용 스킨 3개/월',
      '💎 다이아 닉네임',
      '🎫 VIP 지원',
      '🏰 전용 레이드 입장',
      '🎁 주간 전설 상자',
      '💸 거래 수수료 50% 할인',
      '🏷️ 커스텀 칭호 제작',
      '⚔️ PvP 시즌 보상 2배',
      '👥 길드 슬롯 +15'
    ]
  },
  elite: {
    id: 'elite',
    name: '엘리트',
    emoji: '👑',
    price: 49.99, // $49.99/월
    type: 'subscription',
    benefits: {
      xpBonus: 1.5, // +150%
      goldBonus: 1.0, // +100%
      autoBattleLimit: -1,
      dailyGems: 200,
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost', 'premium_ultimate', 'premium_divine', 'premium_elite'],
      nameColor: '👑',
      prioritySupport: true,
      exclusiveContent: true,
      weeklyLegendaryBox: true,
      tradeFeeDiscount: 0.75, // 75% 할인
      specialTitles: -1,
      guildSlotBonus: 20,
      raidAccess: true,
      customTitle: true,
      pvpSeasonRewardMultiplier: 2,
      exclusiveSkinsMonthly: 5,
      vipSupport: true,
      legendaryPet: true, // 독점 레전더리 펫
      serverBadge: true, // 서버 아이콘 배지
      devQnA: true, // 월간 개발자 Q&A
      betaAccess: true // 신규 기능 베타 우선권
    },
    description: [
      '📈 경험치 +150%',
      '💰 골드 +100% (2배!)',
      '⚡ 오토 배틀 무제한',
      '💎 매일 젬 200개',
      '🎨 특별 이모지',
      '📺 광고 제거',
      '✨ 전용 스킨 5개/월',
      '👑 엘리트 닉네임',
      '🎫 VIP 지원',
      '🏰 전용 레이드 입장',
      '🎁 주간 전설 상자',
      '💸 거래 수수료 75% 할인',
      '🏷️ 커스텀 칭호 제작',
      '⚔️ PvP 시즌 보상 2배',
      '🐉 독점 레전더리 펫',
      '🛡️ 서버 아이콘 배지',
      '💬 월간 개발자 Q&A',
      '🧪 베타 테스트 우선권'
    ]
  },
  founder: {
    id: 'founder',
    name: 'Founder Pack',
    emoji: '🔥',
    price: 99.99, // $99.99 평생 (한정)
    type: 'lifetime',
    limited: 100, // 선착순 100명
    benefits: {
      xpBonus: 1.5, // Elite와 동일
      goldBonus: 1.0,
      autoBattleLimit: -1,
      dailyGems: 200,
      specialEmoji: true,
      adFree: true,
      exclusiveSkills: ['premium_heal', 'premium_boost', 'premium_ultimate', 'premium_divine', 'premium_elite'],
      nameColor: '🔥',
      prioritySupport: true,
      exclusiveContent: true,
      weeklyLegendaryBox: true,
      tradeFeeDiscount: 0.75,
      specialTitles: -1,
      guildSlotBonus: 20,
      raidAccess: true,
      customTitle: true,
      pvpSeasonRewardMultiplier: 2,
      exclusiveSkinsMonthly: 5,
      vipSupport: true,
      legendaryPet: true,
      serverBadge: true,
      devQnA: true,
      betaAccess: true,
      founderTitle: true, // 독점 "Founder" 칭호
      creditListing: true, // 게임 크레딧 이름 등재
      roadmapVote: true, // 개발 로드맵 투표권
      npcAppearance: true // 이벤트 NPC로 등장
    },
    description: [
      '🔥 평생 Elite 혜택',
      '📈 경험치 +150%',
      '💰 골드 +100%',
      '⚡ 오토 배틀 무제한',
      '💎 매일 젬 200개',
      '🏷️ 독점 "Founder" 칭호',
      '📜 게임 크레딧 이름 등재',
      '🗳️ 개발 로드맵 투표권',
      '🎭 이벤트 NPC로 등장',
      '⚠️ 선착순 100명 한정',
      '',
      '+ Elite 모든 혜택 포함'
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
