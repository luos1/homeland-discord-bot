// 연승 보너스 정보
const STREAK_BONUSES = {
  5: {
    threshold: 5,
    name: '5연승',
    emoji: '🔥',
    xpBonus: 0.25, // 25%
    goldBonus: 0.5, // 50%
    attackBonus: 0.1, // 10%
    message: '🔥 5연승 달성! 경험치 +25%, 골드 +50%, 공격력 +10%',
  },
  10: {
    threshold: 10,
    name: '10연승',
    emoji: '🌟',
    xpBonus: 0.5, // 50%
    goldBonus: 1.0, // 100%
    attackBonus: 0.2, // 20%
    specialReward: {
      xp: 1000,
      gold: 500,
    },
    message: '🌟🌟 10연승 달성! 경험치 +50%, 골드 +100%, 공격력 +20%',
    specialMessage: '🎁 특별 보상: 경험치 +1000, 골드 +500G',
  },
  20: {
    threshold: 20,
    name: '20연승',
    emoji: '💫',
    xpBonus: 1.0, // 100%
    goldBonus: 2.0, // 200%
    attackBonus: 0.3, // 30%
    specialReward: {
      xp: 3000,
      gold: 2000,
    },
    message: '💫💫💫 20연승 달성! 경험치 +100%, 골드 +200%, 공격력 +30%',
    specialMessage: '🎁 특별 보상: 경험치 +3000, 골드 +2000G',
  },
};

// 연승 보너스 계산
function calculateStreakBonus(winStreak) {
  let totalXpBonus = 0;
  let totalGoldBonus = 0;
  let totalAttackBonus = 0;
  const messages = [];
  let specialRewards = {
    xp: 0,
    gold: 0,
  };

  // 5연승 이상
  if (winStreak >= 5) {
    const bonus = STREAK_BONUSES[5];
    totalXpBonus += bonus.xpBonus;
    totalGoldBonus += bonus.goldBonus;
    totalAttackBonus += bonus.attackBonus;
  }

  // 10연승 이상
  if (winStreak >= 10) {
    const bonus = STREAK_BONUSES[10];
    totalXpBonus += bonus.xpBonus - STREAK_BONUSES[5].xpBonus; // 추가 분만
    totalGoldBonus += bonus.goldBonus - STREAK_BONUSES[5].goldBonus;
    totalAttackBonus += bonus.attackBonus - STREAK_BONUSES[5].attackBonus;

    if (winStreak === 10 && bonus.specialReward) {
      specialRewards.xp = bonus.specialReward.xp;
      specialRewards.gold = bonus.specialReward.gold;
      messages.push(bonus.specialMessage);
    }
  }

  // 20연승 이상
  if (winStreak >= 20) {
    const bonus = STREAK_BONUSES[20];
    totalXpBonus += bonus.xpBonus - STREAK_BONUSES[10].xpBonus;
    totalGoldBonus += bonus.goldBonus - STREAK_BONUSES[10].goldBonus;
    totalAttackBonus += bonus.attackBonus - STREAK_BONUSES[10].attackBonus;

    if (winStreak === 20 && bonus.specialReward) {
      specialRewards.xp = bonus.specialReward.xp;
      specialRewards.gold = bonus.specialReward.gold;
      messages.push(bonus.specialMessage);
    }
  }

  return {
    xpBonus: totalXpBonus,
    goldBonus: totalGoldBonus,
    attackBonus: totalAttackBonus,
    specialRewards,
    messages,
  };
}

// 연승 업데이트 (승리 시)
function updateWinStreak(character) {
  const newStreak = (character.winStreak || 0) + 1;
  const maxStreak = Math.max(newStreak, character.maxWinStreak || 0);

  const updates = {
    winStreak: newStreak,
    maxWinStreak: maxStreak,
  };

  const messages = [];

  // 마일스톤 달성 시 메시지
  if (newStreak === 5) {
    messages.push(STREAK_BONUSES[5].message);
  } else if (newStreak === 10) {
    messages.push(STREAK_BONUSES[10].message);
    messages.push(STREAK_BONUSES[10].specialMessage);
  } else if (newStreak === 20) {
    messages.push(STREAK_BONUSES[20].message);
    messages.push(STREAK_BONUSES[20].specialMessage);
  } else if (newStreak >= 5) {
    // 5연승 이상일 때 연승 수 표시
    messages.push(`🔥 ${newStreak}연승 중! 보너스 지속 중...`);
  }

  return {
    updates,
    messages,
    newStreak,
  };
}

// 연승 리셋 (패배 시)
function resetWinStreak() {
  return {
    winStreak: 0,
  };
}

// 연승 상태 표시
function getStreakDisplay(winStreak) {
  if (winStreak === 0) {
    return null;
  }

  if (winStreak >= 20) {
    return `💫 ${winStreak}연승 (전설적!)`;
  }

  if (winStreak >= 10) {
    return `🌟 ${winStreak}연승 (대단해요!)`;
  }

  if (winStreak >= 5) {
    return `🔥 ${winStreak}연승`;
  }

  return `✨ ${winStreak}연승`;
}

module.exports = {
  STREAK_BONUSES,
  calculateStreakBonus,
  updateWinStreak,
  resetWinStreak,
  getStreakDisplay,
};
