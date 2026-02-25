/**
 * 프리미엄 전환 최적화 시스템
 * 
 * 특정 시점에 프리미엄 혜택을 자연스럽게 알림
 */

const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./ui');

// 프리미엄 전환 트리거 시점
const CONVERSION_TRIGGERS = {
  LEVEL_10: 10,   // 게임을 이해했을 때
  LEVEL_30: 30,   // 진지하게 플레이 중
  LEVEL_50: 50,   // 헤비 유저
  DAILY_STREAK_7: 7,  // 일주일 연속 플레이
  INVENTORY_FULL: 50, // 가방 가득 참
  DEATH_COUNT_10: 10, // 10번 죽음 (힘듦)
};

/**
 * 프리미엄 혜택 안내 임베드 생성
 */
function createPremiumOfferEmbed(trigger) {
  const messages = {
    [CONVERSION_TRIGGERS.LEVEL_10]: {
      title: '🎉 레벨 10 달성! 프리미엄으로 더 빠르게!',
      description: '지금까지 잘하셨어요! 프리미엄으로 3배 빠르게 성장하세요.',
      highlight: '일일 보상 3배 + 자동 전투로 시간 절약!',
    },
    [CONVERSION_TRIGGERS.LEVEL_30]: {
      title: '💎 레벨 30! 진지한 플레이어를 위한 특별 혜택',
      description: '여기까지 오셨다면 이미 홈랜드의 팬이시군요!',
      highlight: '프리미엄으로 엔드게임 콘텐츠를 더 빠르게 즐기세요!',
    },
    [CONVERSION_TRIGGERS.LEVEL_50]: {
      title: '🏆 레벨 50! 최고 랭크 플레이어 혜택',
      description: '상위 1% 플레이어입니다! 프리미엄으로 더 많은 것을!',
      highlight: '자동 전투 + 전용 코스메틱 + 우선 지원!',
    },
    [CONVERSION_TRIGGERS.DAILY_STREAK_7]: {
      title: '🔥 7일 연속 플레이! 헌신에 감사드립니다',
      description: '매일 플레이하시는 분을 위한 프리미엄 혜택!',
      highlight: '프리미엄 일일 보상은 3배! 7일이면 엄청난 차이!',
    },
    [CONVERSION_TRIGGERS.INVENTORY_FULL]: {
      title: '💼 가방이 가득 찼어요!',
      description: '많은 아이템을 모으셨네요! 프리미엄으로 더 효율적으로!',
      highlight: '자동 판매 + 무제한 보관함!',
    },
    [CONVERSION_TRIGGERS.DEATH_COUNT_10]: {
      title: '💪 힘든 전투를 계속하시는군요!',
      description: '프리미엄 혜택으로 더 쉽게 승리하세요!',
      highlight: '자동 전투 + 보너스 보상으로 빠른 성장!',
    },
  };

  const config = messages[trigger] || messages[CONVERSION_TRIGGERS.LEVEL_10];

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.premium || '#FFD700')
    .setTitle(config.title)
    .setDescription(
      [
        config.description,
        '',
        `✨ **${config.highlight}**`,
        '',
        '💎 **프리미엄 혜택:**',
        '• 일일 보상 3배 (젬, 골드, 경험치)',
        '• 자동 전투 모드 (AFK 성장)',
        '• 전용 코스메틱 아이템',
        '• 우선 지원',
        '• 광고 없음',
        '',
        '💰 **가격: $5/월** (언제든 취소 가능)',
        '',
        '🎁 **첫 달 50% 할인!** (지금만 $2.50)',
        '',
        '명령어: `/premium subscribe`',
      ].join('\n'),
    )
    .setFooter({
      text: '프리미엄은 편의 기능만 제공합니다. 모든 콘텐츠는 무료로 즐기실 수 있습니다.',
    });

  return embed;
}

/**
 * 프리미엄 전환 체크 (레벨업 시)
 */
function shouldShowPremiumOffer(character, trigger) {
  // 이미 프리미엄이면 안 보여줌
  if (character.premiumUntil && new Date(character.premiumUntil) > new Date()) {
    return false;
  }

  // 각 트리거 조건 확인
  switch (trigger) {
    case 'level':
      return (
        character.level === CONVERSION_TRIGGERS.LEVEL_10 ||
        character.level === CONVERSION_TRIGGERS.LEVEL_30 ||
        character.level === CONVERSION_TRIGGERS.LEVEL_50
      );
    
    case 'streak':
      return character.attendanceStreak >= CONVERSION_TRIGGERS.DAILY_STREAK_7;
    
    case 'inventory':
      // 가방 아이템 수 체크 (예시)
      return false; // TODO: 구현
    
    case 'death':
      // 죽음 카운트 체크 (예시)
      return false; // TODO: 구현
    
    default:
      return false;
  }
}

/**
 * 프리미엄 전환율 추적
 */
async function trackConversionEvent(prisma, userId, event) {
  // TODO: 분석 시스템과 연동
  console.log(`[Premium Conversion] User ${userId} - Event: ${event}`);
}

module.exports = {
  CONVERSION_TRIGGERS,
  createPremiumOfferEmbed,
  shouldShowPremiumOffer,
  trackConversionEvent,
};
