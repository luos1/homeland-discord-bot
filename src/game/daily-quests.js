const { applyExperience } = require('./leveling');

const QUEST_TIMEZONE_OFFSET_HOURS = 9; // KST 기준 자정 리셋
const QUEST_TIMEZONE_OFFSET_MS = QUEST_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
const RESET_CHECK_INTERVAL_MS = 60 * 1000;

const DAILY_QUEST_EVENTS = Object.freeze({
  KILL_MONSTER: 'kill_monster',
  KILL_BOSS: 'kill_boss',
  GATHER_RESOURCE: 'gather_resource',
  CRAFT_ITEM: 'craft_item',
  MARKET_TRADE: 'market_trade',
  LOGIN: 'login',
  USE_SKILL: 'use_skill',
});

const WEEKLY_ALL_CLEAR_BONUS = Object.freeze({
  gold: 5000,
  xp: 2500,
});

const QUEST_TEMPLATES = Object.freeze([
  {
    key: 'combat_kill_monsters_8',
    questType: 'combat',
    eventKey: DAILY_QUEST_EVENTS.KILL_MONSTER,
    target: 8,
    rewardGold: 360,
    rewardXp: 190,
    createTitle: (target) => `몬스터 ${target}마리 처치`,
  },
  {
    key: 'combat_kill_monsters_15',
    questType: 'combat',
    eventKey: DAILY_QUEST_EVENTS.KILL_MONSTER,
    target: 15,
    rewardGold: 720,
    rewardXp: 380,
    createTitle: (target) => `몬스터 ${target}마리 처치`,
  },
  {
    key: 'combat_kill_boss_1',
    questType: 'combat',
    eventKey: DAILY_QUEST_EVENTS.KILL_BOSS,
    target: 1,
    rewardGold: 1400,
    rewardXp: 760,
    createTitle: () => '보스 1회 처치',
  },
  {
    key: 'production_gather_20',
    questType: 'production',
    eventKey: DAILY_QUEST_EVENTS.GATHER_RESOURCE,
    target: 20,
    rewardGold: 480,
    rewardXp: 240,
    createTitle: (target) => `자원 ${target}개 채집`,
  },
  {
    key: 'production_gather_35',
    questType: 'production',
    eventKey: DAILY_QUEST_EVENTS.GATHER_RESOURCE,
    target: 35,
    rewardGold: 860,
    rewardXp: 430,
    createTitle: (target) => `자원 ${target}개 채집`,
  },
  {
    key: 'production_craft_2',
    questType: 'production',
    eventKey: DAILY_QUEST_EVENTS.CRAFT_ITEM,
    target: 2,
    rewardGold: 520,
    rewardXp: 260,
    createTitle: (target) => `아이템 ${target}개 제작`,
  },
  {
    key: 'production_craft_4',
    questType: 'production',
    eventKey: DAILY_QUEST_EVENTS.CRAFT_ITEM,
    target: 4,
    rewardGold: 920,
    rewardXp: 460,
    createTitle: (target) => `아이템 ${target}개 제작`,
  },
  {
    key: 'trade_market_2',
    questType: 'trade',
    eventKey: DAILY_QUEST_EVENTS.MARKET_TRADE,
    target: 2,
    rewardGold: 500,
    rewardXp: 250,
    createTitle: (target) => `마켓 거래 ${target}회`,
  },
  {
    key: 'trade_market_5',
    questType: 'trade',
    eventKey: DAILY_QUEST_EVENTS.MARKET_TRADE,
    target: 5,
    rewardGold: 1120,
    rewardXp: 560,
    createTitle: (target) => `마켓 거래 ${target}회`,
  },
  {
    key: 'other_login_1',
    questType: 'other',
    eventKey: DAILY_QUEST_EVENTS.LOGIN,
    target: 1,
    rewardGold: 240,
    rewardXp: 120,
    createTitle: () => '오늘 접속하기',
  },
  {
    key: 'other_use_skill_5',
    questType: 'other',
    eventKey: DAILY_QUEST_EVENTS.USE_SKILL,
    target: 5,
    rewardGold: 360,
    rewardXp: 190,
    createTitle: (target) => `스킬 ${target}회 사용`,
  },
  {
    key: 'other_use_skill_10',
    questType: 'other',
    eventKey: DAILY_QUEST_EVENTS.USE_SKILL,
    target: 10,
    rewardGold: 720,
    rewardXp: 360,
    createTitle: (target) => `스킬 ${target}회 사용`,
  },
]);

const QUEST_TYPE_META = Object.freeze({
  combat: { icon: '⚔️', label: '전투' },
  production: { icon: '🛠️', label: '생산' },
  trade: { icon: '💱', label: '거래' },
  other: { icon: '✨', label: '기타' },
});

const QUESTS_BY_CATEGORY = Object.freeze(
  QUEST_TEMPLATES.reduce(
    (acc, template) => {
      if (!acc[template.questType]) {
        acc[template.questType] = [];
      }

      acc[template.questType].push(template);
      return acc;
    },
    {
      combat: [],
      production: [],
      trade: [],
      other: [],
    },
  ),
);

const QUEST_KEYS_BY_EVENT = Object.freeze(
  QUEST_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.eventKey]) {
      acc[template.eventKey] = [];
    }

    acc[template.eventKey].push(template.key);
    return acc;
  }, {}),
);

const MANDATORY_QUEST_CATEGORIES = ['combat', 'production', 'trade'];

let resetScheduler = null;

function toQuestTimezoneDate(date = new Date()) {
  return new Date(date.getTime() + QUEST_TIMEZONE_OFFSET_MS);
}

function formatDateToDayKey(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getQuestDayKey(date = new Date()) {
  return formatDateToDayKey(toQuestTimezoneDate(date));
}

function parseDayKey(dayKey) {
  const [year, month, day] = dayKey.split('-').map((value) => parseInt(value, 10));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function shiftDayKey(dayKey, offsetDays) {
  const date = parseDayKey(dayKey);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatDateToDayKey(date);
}

function getQuestWeekKey(dayKey) {
  const date = parseDayKey(dayKey);
  const dayOfWeek = date.getUTCDay();
  const shiftToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  date.setUTCDate(date.getUTCDate() + shiftToMonday);
  return formatDateToDayKey(date);
}

function getSecondsUntilNextDailyReset(now = new Date()) {
  const questNow = toQuestTimezoneDate(now);
  const nextReset = new Date(
    Date.UTC(
      questNow.getUTCFullYear(),
      questNow.getUTCMonth(),
      questNow.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );

  return Math.max(0, Math.floor((nextReset.getTime() - questNow.getTime()) / 1000));
}

function createSeededRandom(seedText) {
  let seed = 0;

  for (const ch of seedText) {
    seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  }

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function shuffleWithRandom(items, randomFn) {
  const copied = [...items];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    const temp = copied[i];
    copied[i] = copied[j];
    copied[j] = temp;
  }

  return copied;
}

function pickOne(items, randomFn) {
  if (!items || items.length === 0) {
    return null;
  }

  const index = Math.floor(randomFn() * items.length);
  return items[index];
}

function buildDailyQuestRows(characterId, dayKey) {
  const randomFn = createSeededRandom(`${characterId}:${dayKey}:dailyquest`);
  const questCount = 3 + Math.floor(randomFn() * 3); // 3 ~ 5

  const selected = [];
  const selectedKeys = new Set();

  for (const questType of MANDATORY_QUEST_CATEGORIES) {
    const pool = QUESTS_BY_CATEGORY[questType] || [];
    const picked = pickOne(pool, randomFn);

    if (picked && !selectedKeys.has(picked.key)) {
      selected.push(picked);
      selectedKeys.add(picked.key);
    }
  }

  const optionalPool = shuffleWithRandom(
    QUEST_TEMPLATES.filter((template) => !selectedKeys.has(template.key)),
    randomFn,
  );

  for (const template of optionalPool) {
    if (selected.length >= questCount) {
      break;
    }

    selected.push(template);
    selectedKeys.add(template.key);
  }

  return selected.map((template) => ({
    characterId,
    dayKey,
    questType: template.questType,
    questKey: template.key,
    title: template.createTitle(template.target),
    target: template.target,
    progress: 0,
    completed: false,
    rewardGold: template.rewardGold,
    rewardXp: template.rewardXp,
  }));
}

async function ensureDailyQuestsForDay(db, characterId, dayKey) {
  const existing = await db.dailyQuest.findMany({
    where: {
      characterId,
      dayKey,
    },
    orderBy: {
      id: 'asc',
    },
  });

  if ((existing?.length ?? 0) > 0) {
    return existing;
  }

  const rows = buildDailyQuestRows(characterId, dayKey);

  await db.dailyQuest.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return db.dailyQuest.findMany({
    where: {
      characterId,
      dayKey,
    },
    orderBy: {
      id: 'asc',
    },
  });
}

async function ensureDailyQuests(prisma, characterId, options = {}) {
  const dayKey = options.dayKey || getQuestDayKey();
  return ensureDailyQuestsForDay(prisma, characterId, dayKey);
}

function calculateStreakBonus(streak) {
  const safeStreak = Math.max(1, streak);
  const tier = Math.min(safeStreak, 7);

  return {
    gold: 220 * tier,
    xp: 120 * tier,
  };
}

function createEmptyAllClearBonus(dayKey) {
  return {
    dayKey,
    applied: false,
    streak: 0,
    streakBonus: { gold: 0, xp: 0 },
    weeklyCompletedDays: 0,
    weeklyBonusApplied: false,
    weeklyBonus: { gold: 0, xp: 0 },
    totalGold: 0,
    totalXp: 0,
  };
}

async function applyAllClearBonuses(tx, characterId, dayKey) {
  const weekKey = getQuestWeekKey(dayKey);
  const previousDayKey = shiftDayKey(dayKey, -1);

  const profile = await tx.dailyQuestProfile.upsert({
    where: {
      characterId,
    },
    update: {},
    create: {
      characterId,
      streak: 0,
      lastAllClearDay: null,
      weekKey,
      weeklyCompletedDays: 0,
      weeklyRewardClaimed: false,
    },
  });

  if (profile.lastAllClearDay === dayKey) {
    return createEmptyAllClearBonus(dayKey);
  }

  const nextStreak = profile.lastAllClearDay === previousDayKey ? profile.streak + 1 : 1;
  const streakBonus = calculateStreakBonus(nextStreak);

  const weekChanged = profile.weekKey !== weekKey;
  const baseWeeklyCompletedDays = weekChanged ? 0 : profile.weeklyCompletedDays;
  const nextWeeklyCompletedDays = Math.min(baseWeeklyCompletedDays + 1, 7);
  let nextWeeklyRewardClaimed = weekChanged ? false : profile.weeklyRewardClaimed;

  let weeklyBonus = { gold: 0, xp: 0 };
  let weeklyBonusApplied = false;

  if (nextWeeklyCompletedDays >= 7 && !nextWeeklyRewardClaimed) {
    weeklyBonus = { ...WEEKLY_ALL_CLEAR_BONUS };
    weeklyBonusApplied = true;
    nextWeeklyRewardClaimed = true;
  }

  await tx.dailyQuestProfile.update({
    where: {
      characterId,
    },
    data: {
      streak: nextStreak,
      lastAllClearDay: dayKey,
      weekKey,
      weeklyCompletedDays: nextWeeklyCompletedDays,
      weeklyRewardClaimed: nextWeeklyRewardClaimed,
    },
  });

  return {
    dayKey,
    applied: true,
    streak: nextStreak,
    streakBonus,
    weeklyCompletedDays: nextWeeklyCompletedDays,
    weeklyBonusApplied,
    weeklyBonus,
    totalGold: streakBonus.gold + weeklyBonus.gold,
    totalXp: streakBonus.xp + weeklyBonus.xp,
  };
}

async function awardCharacterRewards(tx, characterId, rewardGold, rewardXp) {
  if (rewardGold <= 0 && rewardXp <= 0) {
    return {
      levelsGained: 0,
    };
  }

  const character = await tx.character.findUnique({
    where: {
      id: characterId,
    },
  });

  if (!character) {
    return {
      levelsGained: 0,
    };
  }

  let characterUpdate = {};
  let levelsGained = 0;

  if (rewardXp > 0) {
    const leveling = applyExperience(
      character,
      rewardXp,
      character.hp,
      character.mana ?? character.maxMana ?? 0,
    );

    characterUpdate = leveling.characterUpdate;
    levelsGained = leveling.levelsGained;
  }

  await tx.character.update({
    where: {
      id: characterId,
    },
    data: {
      ...characterUpdate,
      gold: character.gold + rewardGold,
    },
  });

  return {
    levelsGained,
  };
}

async function recordDailyQuestProgress(
  prisma,
  characterId,
  eventKey,
  amount = 1,
  options = {},
) {
  const dayKey = options.dayKey || getQuestDayKey();
  const safeAmount = Math.max(1, Math.floor(amount));
  const targetQuestKeys = QUEST_KEYS_BY_EVENT[eventKey] || [];

  if (targetQuestKeys.length === 0) {
    return {
      dayKey,
      eventKey,
      amount: safeAmount,
      completedQuestIds: [],
      questRewardGold: 0,
      questRewardXp: 0,
      allClearBonus: createEmptyAllClearBonus(dayKey),
      totalRewardGold: 0,
      totalRewardXp: 0,
      levelsGained: 0,
    };
  }

  return prisma.$transaction(async (tx) => {
    if (!options.skipEnsure) {
      await ensureDailyQuestsForDay(tx, characterId, dayKey);
    }

    const activeQuests = await tx.dailyQuest.findMany({
      where: {
        characterId,
        dayKey,
        questKey: {
          in: targetQuestKeys,
        },
        completed: false,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if ((activeQuests?.length ?? 0) === 0) {
      return {
        dayKey,
        eventKey,
        amount: safeAmount,
        completedQuestIds: [],
        questRewardGold: 0,
        questRewardXp: 0,
        allClearBonus: createEmptyAllClearBonus(dayKey),
        totalRewardGold: 0,
        totalRewardXp: 0,
        levelsGained: 0,
      };
    }

    const now = new Date();
    const completedQuestIds = [];
    let questRewardGold = 0;
    let questRewardXp = 0;

    for (const quest of activeQuests) {
      const nextProgress = Math.min(quest.target, quest.progress + safeAmount);
      const becameCompleted = nextProgress >= quest.target;

      await tx.dailyQuest.update({
        where: {
          id: quest.id,
        },
        data: {
          progress: nextProgress,
          completed: becameCompleted,
          completedAt: becameCompleted ? now : quest.completedAt,
        },
      });

      if (becameCompleted) {
        completedQuestIds.push(quest.id);
        questRewardGold += quest.rewardGold;
        questRewardXp += quest.rewardXp;
      }
    }

    let allClearBonus = createEmptyAllClearBonus(dayKey);

    if (completedQuestIds.length > 0) {
      const remainingCount = await tx.dailyQuest.count({
        where: {
          characterId,
          dayKey,
          completed: false,
        },
      });

      if (remainingCount === 0) {
        allClearBonus = await applyAllClearBonuses(tx, characterId, dayKey);
      }
    }

    const totalRewardGold = questRewardGold + allClearBonus.totalGold;
    const totalRewardXp = questRewardXp + allClearBonus.totalXp;
    const rewardResult = await awardCharacterRewards(tx, characterId, totalRewardGold, totalRewardXp);

    return {
      dayKey,
      eventKey,
      amount: safeAmount,
      completedQuestIds,
      questRewardGold,
      questRewardXp,
      allClearBonus,
      totalRewardGold,
      totalRewardXp,
      levelsGained: rewardResult.levelsGained,
    };
  });
}

async function getDailyQuestStatus(prisma, characterId, options = {}) {
  const dayKey = options.dayKey || getQuestDayKey();

  await ensureDailyQuests(prisma, characterId, { dayKey });

  if (options.markLogin) {
    await recordDailyQuestProgress(prisma, characterId, DAILY_QUEST_EVENTS.LOGIN, 1, {
      dayKey,
      skipEnsure: true,
    });
  }

  const [quests, profile] = await Promise.all([
    prisma.dailyQuest.findMany({
      where: {
        characterId,
        dayKey,
      },
      orderBy: {
        id: 'asc',
      },
    }),
    prisma.dailyQuestProfile.findUnique({
      where: {
        characterId,
      },
    }),
  ]);

  return {
    dayKey,
    quests,
    profile: profile || {
      characterId,
      streak: 0,
      lastAllClearDay: null,
      weekKey: getQuestWeekKey(dayKey),
      weeklyCompletedDays: 0,
      weeklyRewardClaimed: false,
    },
  };
}

async function resetDailyQuestsForAllCharacters(prisma, dayKey = getQuestDayKey()) {
  const characters = await prisma.character.findMany({
    select: {
      id: true,
    },
  });

  let preparedCount = 0;

  for (const character of characters) {
    await ensureDailyQuests(prisma, character.id, { dayKey });
    preparedCount += 1;
  }

  return {
    dayKey,
    preparedCount,
  };
}

function startDailyQuestResetScheduler(prisma) {
  if (resetScheduler) {
    return;
  }

  let lastDayKey = getQuestDayKey();

  resetScheduler = setInterval(async () => {
    const currentDayKey = getQuestDayKey();

    if (currentDayKey === lastDayKey) {
      return;
    }

    lastDayKey = currentDayKey;

    try {
      const result = await resetDailyQuestsForAllCharacters(prisma, currentDayKey);
      console.log(
        `🌙 Daily quest reset complete: ${result.dayKey} (prepared ${result.preparedCount} characters)`,
      );
    } catch (error) {
      console.error('Daily quest reset failed:', error);
    }
  }, RESET_CHECK_INTERVAL_MS);

  if (typeof resetScheduler.unref === 'function') {
    resetScheduler.unref();
  }

  console.log(`🌙 Daily quest reset scheduler started (dayKey=${lastDayKey})`);
}

function stopDailyQuestResetScheduler() {
  if (!resetScheduler) {
    return;
  }

  clearInterval(resetScheduler);
  resetScheduler = null;
}

module.exports = {
  DAILY_QUEST_EVENTS,
  QUEST_TYPE_META,
  WEEKLY_ALL_CLEAR_BONUS,
  getQuestDayKey,
  getQuestWeekKey,
  getSecondsUntilNextDailyReset,
  ensureDailyQuests,
  recordDailyQuestProgress,
  getDailyQuestStatus,
  resetDailyQuestsForAllCharacters,
  startDailyQuestResetScheduler,
  stopDailyQuestResetScheduler,
};
