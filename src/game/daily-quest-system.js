/**
 * 일일 퀘스트 시스템
 * 
 * - 매일 갱신되는 퀘스트
 * - 완료 시 보상
 * - 연속 완료 보너스
 */

// 일일 퀘스트 목록
const DAILY_QUESTS = [
  {
    id: 'kill_monsters_5',
    name: '몬스터 사냥',
    description: '몬스터 5마리 처치',
    type: 'kill',
    target: 5,
    rewards: {
      gold: 500,
      xp: 200
    }
  },
  {
    id: 'kill_monsters_10',
    name: '몬스터 대량 사냥',
    description: '몬스터 10마리 처치',
    type: 'kill',
    target: 10,
    rewards: {
      gold: 1500,
      xp: 500
    }
  },
  {
    id: 'level_up',
    name: '레벨 업',
    description: '레벨 1회 상승',
    type: 'levelup',
    target: 1,
    rewards: {
      gold: 1000,
      xp: 0
    }
  },
  {
    id: 'enhance_3',
    name: '장비 강화',
    description: '장비 3회 강화 (성공/실패 무관)',
    type: 'enhance',
    target: 3,
    rewards: {
      gold: 2000,
      xp: 300
    }
  },
  {
    id: 'trade_1',
    name: '거래',
    description: '거래 1회 완료',
    type: 'trade',
    target: 1,
    rewards: {
      gold: 800,
      xp: 150
    }
  },
  {
    id: 'win_streak_3',
    name: '연승',
    description: '3연승 달성',
    type: 'streak',
    target: 3,
    rewards: {
      gold: 1200,
      xp: 400
    }
  }
];

/**
 * 오늘의 일일 퀘스트 선택 (랜덤 3개)
 */
function selectDailyQuests(date = new Date()) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  
  // Seeded random
  const rng = seededRandom(seed);
  
  const shuffled = [...DAILY_QUESTS].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Seeded random (같은 날은 같은 퀘스트)
 */
function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * 퀘스트 진행도 업데이트
 */
async function updateQuestProgress(userId, questType, amount = 1, prisma) {
  const today = new Date().toISOString().split('T')[0];
  
  // 오늘의 퀘스트 조회
  let dailyProgress = await prisma.dailyQuestProgress.findUnique({
    where: {
      userId_date: {
        userId,
        date: today
      }
    }
  });
  
  if (!dailyProgress) {
    // 오늘 처음 - 퀘스트 초기화
    const todayQuests = selectDailyQuests();
    dailyProgress = await prisma.dailyQuestProgress.create({
      data: {
        userId,
        date: today,
        quests: todayQuests.map(q => ({
          id: q.id,
          progress: 0,
          target: q.target,
          completed: false
        }))
      }
    });
  }
  
  // 진행도 업데이트
  const quests = dailyProgress.quests;
  let updated = false;
  
  for (const quest of quests) {
    const questData = DAILY_QUESTS.find(q => q.id === quest.id);
    if (questData && questData.type === questType && !quest.completed) {
      quest.progress = Math.min(quest.target, quest.progress + amount);
      if (quest.progress >= quest.target) {
        quest.completed = true;
      }
      updated = true;
    }
  }
  
  if (updated) {
    await prisma.dailyQuestProgress.update({
      where: { id: dailyProgress.id },
      data: { quests }
    });
  }
  
  return { success: true, quests };
}

/**
 * 퀘스트 보상 수령
 */
async function claimQuestReward(userId, questId, prisma) {
  const today = new Date().toISOString().split('T')[0];
  
  const dailyProgress = await prisma.dailyQuestProgress.findUnique({
    where: {
      userId_date: {
        userId,
        date: today
      }
    }
  });
  
  if (!dailyProgress) {
    return { success: false, error: '오늘의 퀘스트를 찾을 수 없습니다.' };
  }
  
  const quest = dailyProgress.quests.find(q => q.id === questId);
  
  if (!quest) {
    return { success: false, error: '퀘스트를 찾을 수 없습니다.' };
  }
  
  if (!quest.completed) {
    return { success: false, error: '퀘스트가 아직 완료되지 않았습니다.' };
  }
  
  if (quest.claimed) {
    return { success: false, error: '이미 보상을 받았습니다.' };
  }
  
  const questData = DAILY_QUESTS.find(q => q.id === questId);
  
  if (!questData) {
    return { success: false, error: '퀘스트 데이터를 찾을 수 없습니다.' };
  }
  
  // 보상 지급
  const character = await prisma.character.findUnique({
    where: { userId }
  });
  
  await prisma.character.update({
    where: { userId },
    data: {
      gold: character.gold + questData.rewards.gold,
      xp: character.xp + questData.rewards.xp
    }
  });
  
  // 클레임 표시
  quest.claimed = true;
  await prisma.dailyQuestProgress.update({
    where: { id: dailyProgress.id },
    data: { quests: dailyProgress.quests }
  });
  
  return {
    success: true,
    rewards: questData.rewards
  };
}

/**
 * 오늘의 퀘스트 목록 조회
 */
async function getTodayQuests(userId, prisma) {
  const today = new Date().toISOString().split('T')[0];
  
  let dailyProgress = await prisma.dailyQuestProgress.findUnique({
    where: {
      userId_date: {
        userId,
        date: today
      }
    }
  });
  
  if (!dailyProgress) {
    // 오늘 처음
    const todayQuests = selectDailyQuests();
    dailyProgress = await prisma.dailyQuestProgress.create({
      data: {
        userId,
        date: today,
        quests: todayQuests.map(q => ({
          id: q.id,
          progress: 0,
          target: q.target,
          completed: false,
          claimed: false
        }))
      }
    });
  }
  
  // 퀘스트 데이터와 진행도 합치기
  const quests = dailyProgress.quests.map(q => {
    const data = DAILY_QUESTS.find(qd => qd.id === q.id);
    return {
      ...data,
      progress: q.progress,
      completed: q.completed,
      claimed: q.claimed || false
    };
  });
  
  return { success: true, quests };
}

module.exports = {
  DAILY_QUESTS,
  selectDailyQuests,
  updateQuestProgress,
  claimQuestReward,
  getTodayQuests
};
