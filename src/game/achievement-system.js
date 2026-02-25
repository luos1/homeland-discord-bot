/**
 * Achievement System
 * 업적 달성 시 보상 지급 + 칭호 획득
 */

const ACHIEVEMENTS = {
  // ═══════════════════════════════════════════════════════════════
  // 전투 업적
  // ═══════════════════════════════════════════════════════════════
  first_blood: {
    id: 'first_blood',
    name: '첫 발걸음',
    description: '첫 번째 전투 승리',
    category: 'combat',
    requirement: { type: 'battles_won', value: 1 },
    rewards: { gold: 100, xp: 50 },
    title: null,
    emoji: '🗡️',
    hidden: false,
  },
  warrior_10: {
    id: 'warrior_10',
    name: '초보 전사',
    description: '전투 10회 승리',
    category: 'combat',
    requirement: { type: 'battles_won', value: 10 },
    rewards: { gold: 500, xp: 200 },
    title: '초보 전사',
    emoji: '⚔️',
    hidden: false,
  },
  warrior_100: {
    id: 'warrior_100',
    name: '숙련된 전사',
    description: '전투 100회 승리',
    category: 'combat',
    requirement: { type: 'battles_won', value: 100 },
    rewards: { gold: 2000, xp: 1000, gems: 50 },
    title: '숙련된 전사',
    emoji: '🛡️',
    hidden: false,
  },
  warrior_1000: {
    id: 'warrior_1000',
    name: '전설의 전사',
    description: '전투 1000회 승리',
    category: 'combat',
    requirement: { type: 'battles_won', value: 1000 },
    rewards: { gold: 10000, xp: 5000, gems: 200 },
    title: '전설의 전사',
    emoji: '👑',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 보스 업적
  // ═══════════════════════════════════════════════════════════════
  boss_slayer: {
    id: 'boss_slayer',
    name: '보스 슬레이어',
    description: '첫 보스 처치',
    category: 'boss',
    requirement: { type: 'bosses_killed', value: 1 },
    rewards: { gold: 500, xp: 300 },
    title: null,
    emoji: '🐉',
    hidden: false,
  },
  boss_hunter_10: {
    id: 'boss_hunter_10',
    name: '보스 헌터',
    description: '보스 10회 처치',
    category: 'boss',
    requirement: { type: 'bosses_killed', value: 10 },
    rewards: { gold: 2000, xp: 1000, gems: 30 },
    title: '보스 헌터',
    emoji: '🎯',
    hidden: false,
  },
  boss_master: {
    id: 'boss_master',
    name: '보스 마스터',
    description: '보스 50회 처치',
    category: 'boss',
    requirement: { type: 'bosses_killed', value: 50 },
    rewards: { gold: 10000, xp: 5000, gems: 100 },
    title: '보스 마스터',
    emoji: '💀',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 레벨 업적
  // ═══════════════════════════════════════════════════════════════
  level_10: {
    id: 'level_10',
    name: '성장하는 영웅',
    description: '레벨 10 달성',
    category: 'level',
    requirement: { type: 'level', value: 10 },
    rewards: { gold: 500, xp: 0 },
    title: '신예 모험가',
    emoji: '📈',
    hidden: false,
  },
  level_25: {
    id: 'level_25',
    name: '중견 모험가',
    description: '레벨 25 달성',
    category: 'level',
    requirement: { type: 'level', value: 25 },
    rewards: { gold: 2000, gems: 50 },
    title: '중견 모험가',
    emoji: '⭐',
    hidden: false,
  },
  level_50: {
    id: 'level_50',
    name: '베테랑',
    description: '레벨 50 달성',
    category: 'level',
    requirement: { type: 'level', value: 50 },
    rewards: { gold: 5000, gems: 100 },
    title: '베테랑',
    emoji: '🌟',
    hidden: false,
  },
  level_100: {
    id: 'level_100',
    name: '전설의 영웅',
    description: '최대 레벨 100 달성',
    category: 'level',
    requirement: { type: 'level', value: 100 },
    rewards: { gold: 50000, gems: 500 },
    title: '전설의 영웅',
    emoji: '👑',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 재화 업적
  // ═══════════════════════════════════════════════════════════════
  rich_1k: {
    id: 'rich_1k',
    name: '첫 천금',
    description: '골드 1,000G 모으기',
    category: 'wealth',
    requirement: { type: 'gold_total', value: 1000 },
    rewards: { xp: 100 },
    title: null,
    emoji: '💰',
    hidden: false,
  },
  rich_10k: {
    id: 'rich_10k',
    name: '부자의 길',
    description: '골드 10,000G 모으기',
    category: 'wealth',
    requirement: { type: 'gold_total', value: 10000 },
    rewards: { xp: 500, gems: 20 },
    title: '부자',
    emoji: '💎',
    hidden: false,
  },
  rich_100k: {
    id: 'rich_100k',
    name: '백만장자',
    description: '골드 100,000G 모으기',
    category: 'wealth',
    requirement: { type: 'gold_total', value: 100000 },
    rewards: { xp: 2000, gems: 100 },
    title: '백만장자',
    emoji: '🏦',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 출석 업적
  // ═══════════════════════════════════════════════════════════════
  attendance_7: {
    id: 'attendance_7',
    name: '일주일 개근',
    description: '7일 연속 출석',
    category: 'attendance',
    requirement: { type: 'attendance_streak', value: 7 },
    rewards: { gold: 1000, gems: 20 },
    title: null,
    emoji: '📅',
    hidden: false,
  },
  attendance_30: {
    id: 'attendance_30',
    name: '한달 개근',
    description: '30일 연속 출석',
    category: 'attendance',
    requirement: { type: 'attendance_streak', value: 30 },
    rewards: { gold: 5000, gems: 100 },
    title: '성실한 모험가',
    emoji: '🏆',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 도박 업적
  // ═══════════════════════════════════════════════════════════════
  gambler_first: {
    id: 'gambler_first',
    name: '도박의 시작',
    description: '첫 도박 시도',
    category: 'gambling',
    requirement: { type: 'gambles_played', value: 1 },
    rewards: { gold: 100 },
    title: null,
    emoji: '🎰',
    hidden: false,
  },
  gambler_100: {
    id: 'gambler_100',
    name: '도박꾼',
    description: '도박 100회 플레이',
    category: 'gambling',
    requirement: { type: 'gambles_played', value: 100 },
    rewards: { gold: 2000, gems: 30 },
    title: '도박꾼',
    emoji: '🃏',
    hidden: false,
  },
  jackpot_winner: {
    id: 'jackpot_winner',
    name: '잭팟!',
    description: '슬롯 잭팟 당첨',
    category: 'gambling',
    requirement: { type: 'jackpot_won', value: 1 },
    rewards: { gold: 5000, gems: 50 },
    title: '행운아',
    emoji: '🍀',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 경제 업적 (추가)
  // ═══════════════════════════════════════════════════════════════
  trader_10: {
    id: 'trader_10',
    name: '상인 견습생',
    description: '거래 10회 완료',
    category: 'wealth',
    requirement: { type: 'trades_total', value: 10 },
    rewards: { gold: 1000, xp: 300 },
    title: '상인 견습생',
    emoji: '🛒',
    hidden: false,
  },
  trader_100: {
    id: 'trader_100',
    name: '대상인',
    description: '거래 100회 완료',
    category: 'wealth',
    requirement: { type: 'trades_total', value: 100 },
    rewards: { gold: 10000, xp: 2000, gems: 100 },
    title: '대상인',
    emoji: '📈',
    hidden: false,
  },
  spender_10k: {
    id: 'spender_10k',
    name: '소비왕',
    description: '골드 10,000G 소비',
    category: 'wealth',
    requirement: { type: 'gold_spent', value: 10000 },
    rewards: { xp: 500, gems: 20 },
    title: null,
    emoji: '💸',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 생산 업적
  // ═══════════════════════════════════════════════════════════════
  gatherer_50: {
    id: 'gatherer_50',
    name: '초보 채집가',
    description: '자원 50개 채집',
    category: 'production',
    requirement: { type: 'resources_gathered', value: 50 },
    rewards: { gold: 500, xp: 200 },
    title: null,
    emoji: '🌾',
    hidden: false,
  },
  gatherer_500: {
    id: 'gatherer_500',
    name: '숙련 채집가',
    description: '자원 500개 채집',
    category: 'production',
    requirement: { type: 'resources_gathered', value: 500 },
    rewards: { gold: 3000, xp: 1000, gems: 50 },
    title: '채집의 달인',
    emoji: '⛏️',
    hidden: false,
  },
  crafter_10: {
    id: 'crafter_10',
    name: '초보 제작자',
    description: '아이템 10개 제작',
    category: 'production',
    requirement: { type: 'items_crafted', value: 10 },
    rewards: { gold: 1000, xp: 300 },
    title: null,
    emoji: '🔨',
    hidden: false,
  },
  crafter_100: {
    id: 'crafter_100',
    name: '장인',
    description: '아이템 100개 제작',
    category: 'production',
    requirement: { type: 'items_crafted', value: 100 },
    rewards: { gold: 5000, xp: 2000, gems: 80 },
    title: '장인',
    emoji: '🛠️',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 소셜 업적
  // ═══════════════════════════════════════════════════════════════
  guild_member: {
    id: 'guild_member',
    name: '길드 가입',
    description: '첫 길드 가입',
    category: 'social',
    requirement: { type: 'guild_joined', value: 1 },
    rewards: { gold: 500, xp: 200 },
    title: null,
    emoji: '🏰',
    hidden: false,
  },
  guild_contributor: {
    id: 'guild_contributor',
    name: '길드 공헌자',
    description: '길드에 10,000G 기부',
    category: 'social',
    requirement: { type: 'guild_contribution', value: 10000 },
    rewards: { gold: 2000, gems: 50 },
    title: '길드 공헌자',
    emoji: '🎖️',
    hidden: false,
  },
  arena_warrior: {
    id: 'arena_warrior',
    name: '아레나 전사',
    description: '아레나 10승 달성',
    category: 'social',
    requirement: { type: 'arena_wins', value: 10 },
    rewards: { gold: 2000, xp: 1000, gems: 30 },
    title: '검투사',
    emoji: '⚔️',
    hidden: false,
  },
  arena_champion: {
    id: 'arena_champion',
    name: '아레나 챔피언',
    description: '아레나 50승 달성',
    category: 'social',
    requirement: { type: 'arena_wins', value: 50 },
    rewards: { gold: 10000, xp: 5000, gems: 150 },
    title: '아레나 챔피언',
    emoji: '👑',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 강화 업적
  // ═══════════════════════════════════════════════════════════════
  enhancer_5: {
    id: 'enhancer_5',
    name: '강화 입문',
    description: '장비 강화 5회 성공',
    category: 'enhancement',
    requirement: { type: 'enhancements_success', value: 5 },
    rewards: { gold: 1000, xp: 300 },
    title: null,
    emoji: '✨',
    hidden: false,
  },
  enhancer_50: {
    id: 'enhancer_50',
    name: '강화의 달인',
    description: '장비 강화 50회 성공',
    category: 'enhancement',
    requirement: { type: 'enhancements_success', value: 50 },
    rewards: { gold: 10000, xp: 3000, gems: 100 },
    title: '강화의 달인',
    emoji: '⚡',
    hidden: false,
  },
  enhancement_10: {
    id: 'enhancement_10',
    name: '+10 달성',
    description: '장비를 +10까지 강화',
    category: 'enhancement',
    requirement: { type: 'max_enhancement', value: 10 },
    rewards: { gold: 5000, gems: 50 },
    title: '강화왕',
    emoji: '💫',
    hidden: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // 숨겨진 업적
  // ═══════════════════════════════════════════════════════════════
  night_owl: {
    id: 'night_owl',
    name: '올빼미',
    description: '새벽 3시~5시에 플레이',
    category: 'hidden',
    requirement: { type: 'play_time', value: 'night' },
    rewards: { gold: 500 },
    title: '올빼미',
    emoji: '🦉',
    hidden: true,
  },
  streak_10: {
    id: 'streak_10',
    name: '연승왕',
    description: '10연승 달성',
    category: 'hidden',
    requirement: { type: 'win_streak', value: 10 },
    rewards: { gold: 3000, gems: 50 },
    title: '연승왕',
    emoji: '🔥',
    hidden: true,
  },
  lucky_spinner: {
    id: 'lucky_spinner',
    name: '행운의 손',
    description: '룰렛에서 레전더리 상자 획득',
    category: 'hidden',
    requirement: { type: 'spin_legendary', value: 1 },
    rewards: { gold: 5000, gems: 100 },
    title: '행운의 손',
    emoji: '🍀',
    hidden: true,
  },
  perfect_attendance: {
    id: 'perfect_attendance',
    name: '완벽한 출석',
    description: '출석 100일 달성',
    category: 'hidden',
    requirement: { type: 'total_attendance', value: 100 },
    rewards: { gold: 20000, gems: 200 },
    title: '완벽한 출석',
    emoji: '📅',
    hidden: true,
  },
  rich_millionaire: {
    id: 'rich_millionaire',
    name: '백만장자의 꿈',
    description: '한 번에 골드 1,000,000G 보유',
    category: 'hidden',
    requirement: { type: 'gold_total', value: 1000000 },
    rewards: { gems: 500 },
    title: '백만장자',
    emoji: '💰',
    hidden: true,
  },
};

const CATEGORY_NAMES = {
  combat: '⚔️ 전투',
  boss: '🐉 보스',
  level: '📈 성장',
  wealth: '💰 재화',
  attendance: '📅 출석',
  gambling: '🎰 도박',
  production: '🛠️ 생산',
  social: '👥 소셜',
  enhancement: '✨ 강화',
  hidden: '❓ 숨겨진 업적',
};

/**
 * 업적 달성 여부 체크
 */
async function checkAchievement(prisma, characterId, achievementId) {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return null;

  // 이미 달성한 업적인지 확인
  const existing = await prisma.characterAchievement.findUnique({
    where: {
      characterId_achievementId: {
        characterId,
        achievementId,
      },
    },
  });

  if (existing) return null;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      stats: true,
    },
  });

  if (!character) return null;

  const stats = character.stats || {};
  const { type, value } = achievement.requirement;

  let achieved = false;

  switch (type) {
    case 'battles_won':
      achieved = (stats.battlesWon || 0) >= value;
      break;
    case 'bosses_killed':
      achieved = (stats.bossesKilled || 0) >= value;
      break;
    case 'level':
      achieved = character.level >= value;
      break;
    case 'gold_total':
      achieved = (stats.goldEarned || 0) >= value || character.gold >= value;
      break;
    case 'gold_spent':
      achieved = (stats.goldSpent || 0) >= value;
      break;
    case 'attendance_streak':
      achieved = (stats.maxAttendanceStreak || 0) >= value;
      break;
    case 'total_attendance':
      achieved = (stats.totalAttendance || 0) >= value;
      break;
    case 'gambles_played':
      achieved = (stats.gamblesPlayed || 0) >= value;
      break;
    case 'jackpot_won':
      achieved = (stats.jackpotsWon || 0) >= value;
      break;
    case 'win_streak':
      achieved = (stats.maxWinStreak || 0) >= value;
      break;
    case 'trades_total':
      achieved = (stats.tradesTotal || 0) >= value;
      break;
    case 'resources_gathered':
      achieved = (stats.resourcesGathered || 0) >= value;
      break;
    case 'items_crafted':
      achieved = (stats.itemsCrafted || 0) >= value;
      break;
    case 'guild_joined':
      achieved = (stats.guildJoined || 0) >= value;
      break;
    case 'guild_contribution':
      achieved = (stats.guildContribution || 0) >= value;
      break;
    case 'arena_wins':
      achieved = (stats.arenaWins || 0) >= value;
      break;
    case 'enhancements_success':
      achieved = (stats.enhancementsSuccess || 0) >= value;
      break;
    case 'max_enhancement':
      achieved = (stats.maxEnhancement || 0) >= value;
      break;
    case 'spin_legendary':
      achieved = (stats.spinLegendary || 0) >= value;
      break;
    case 'play_time':
      // 특수 케이스: 서버에서 별도 체크
      break;
    default:
      break;
  }

  return achieved ? achievement : null;
}

/**
 * 업적 달성 처리 및 보상 지급
 */
async function grantAchievement(prisma, characterId, achievementId) {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 업적 기록
      await tx.characterAchievement.create({
        data: {
          characterId,
          achievementId,
          unlockedAt: new Date(),
        },
      });

      // 보상 지급
      const updateData = {};
      if (achievement.rewards.gold) {
        updateData.gold = { increment: achievement.rewards.gold };
      }
      if (achievement.rewards.gems) {
        updateData.gems = { increment: achievement.rewards.gems };
      }
      if (achievement.rewards.xp) {
        updateData.xp = { increment: achievement.rewards.xp };
      }
      if (achievement.title) {
        updateData.title = achievement.title;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.character.update({
          where: { id: characterId },
          data: updateData,
        });
      }

      return achievement;
    });

    return result;
  } catch (error) {
    if (error.code === 'P2002') {
      // 이미 달성한 업적
      return null;
    }
    throw error;
  }
}

/**
 * 특정 이벤트 발생 시 관련 업적 체크
 */
async function checkAchievementsForEvent(prisma, characterId, eventType, value = 1) {
  const unlockedAchievements = [];

  // 이벤트 타입에 따라 관련 업적 체크
  const relevantAchievements = Object.values(ACHIEVEMENTS).filter(
    (a) => a.requirement.type === eventType
  );

  for (const achievement of relevantAchievements) {
    const result = await checkAchievement(prisma, characterId, achievement.id);
    if (result) {
      const granted = await grantAchievement(prisma, characterId, achievement.id);
      if (granted) {
        unlockedAchievements.push(granted);
      }
    }
  }

  return unlockedAchievements;
}

/**
 * 유저의 모든 업적 조회
 */
async function getCharacterAchievements(prisma, characterId) {
  const unlocked = await prisma.characterAchievement.findMany({
    where: { characterId },
  });

  const unlockedIds = new Set(unlocked.map((a) => a.achievementId));

  const allAchievements = Object.values(ACHIEVEMENTS).map((achievement) => ({
    ...achievement,
    unlocked: unlockedIds.has(achievement.id),
    unlockedAt: unlocked.find((a) => a.achievementId === achievement.id)?.unlockedAt,
  }));

  return allAchievements;
}

module.exports = {
  ACHIEVEMENTS,
  CATEGORY_NAMES,
  checkAchievement,
  grantAchievement,
  checkAchievementsForEvent,
  getCharacterAchievements,
};
