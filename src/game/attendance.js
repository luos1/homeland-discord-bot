const ATTENDANCE_TIMEZONE = 'Asia/Seoul';
const DEFAULT_DAILY_GOLD = 100;

const ATTENDANCE_REWARDS = {
  1: {
    gold: 100,
    consumables: [],
    equipmentRarity: null,
    petKey: null,
    premiumDays: null,
  },
  3: {
    gold: 300,
    consumables: [],
    equipmentRarity: 'rare', // 변경: 레어 장비
    petKey: null,
    premiumDays: null,
  },
  7: {
    gold: 1000,
    gems: 30,
    consumables: [],
    equipmentRarity: null,
    petKey: 'legendary_phoenix', // 변경: 레전더리 펫
    premiumDays: null,
  },
  14: {
    gold: 3000,
    gems: 50,
    consumables: [],
    equipmentRarity: 'epic',
    petKey: null,
    premiumDays: null,
  },
  30: {
    gold: 10000,
    gems: 100,
    consumables: [],
    equipmentRarity: 'legendary',
    petKey: null,
    premiumDays: 30, // 변경: 프리미엄 1개월
    title: '개근상',
  },
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ATTENDANCE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateKey(dateKey) {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');

  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
}

function shiftDateKey(dateKey, days) {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day));

  shifted.setUTCDate(shifted.getUTCDate() + days);

  return toDateKey(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

function getDateKeyInKST(now = new Date()) {
  const parts = DATE_FORMATTER.formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');

  return toDateKey(year, month, day);
}

function getMonthMetaFromDateKey(dateKey) {
  const { year, month } = parseDateKey(dateKey);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    year,
    month,
    monthKey: dateKey.slice(0, 7),
    firstWeekday,
    daysInMonth,
  };
}

function calculateNextAttendanceStreak(latestRecord, todayDateKey) {
  if (!latestRecord) {
    return {
      streak: 1,
      reset: false,
      alreadyClaimedToday: false,
    };
  }

  if (latestRecord.date === todayDateKey) {
    return {
      streak: latestRecord.streak,
      reset: false,
      alreadyClaimedToday: true,
    };
  }

  const yesterdayDateKey = shiftDateKey(todayDateKey, -1);

  if (latestRecord.date === yesterdayDateKey) {
    return {
      streak: latestRecord.streak + 1,
      reset: false,
      alreadyClaimedToday: false,
    };
  }

  return {
    streak: 1,
    reset: true,
    alreadyClaimedToday: false,
  };
}

function getAttendanceReward(streak) {
  const milestoneReward = ATTENDANCE_REWARDS[streak];

  if (milestoneReward) {
    return {
      streak,
      isMilestone: true,
      gold: milestoneReward.gold,
      gems: milestoneReward.gems || 0,
      consumables: milestoneReward.consumables || [],
      equipmentRarity: milestoneReward.equipmentRarity || null,
      petKey: milestoneReward.petKey || null,
      premiumDays: milestoneReward.premiumDays || null,
      title: milestoneReward.title || null,
    };
  }

  return {
    streak,
    isMilestone: false,
    gold: DEFAULT_DAILY_GOLD,
    gems: 0,
    consumables: [],
    equipmentRarity: null,
    petKey: null,
    premiumDays: null,
    title: null,
  };
}

function renderAttendanceCalendar({
  monthMeta,
  monthlyRecords,
  todayDateKey,
}) {
  const claimedByDay = new Set(
    monthlyRecords.filter((record) => record.claimed).map((record) => record.date),
  );

  const rows = [];
  const currentRow = [];

  for (let i = 0; i < monthMeta.firstWeekday; i += 1) {
    currentRow.push('   ');
  }

  for (let day = 1; day <= monthMeta.daysInMonth; day += 1) {
    const dateKey = toDateKey(monthMeta.year, monthMeta.month, day);
    const claimed = claimedByDay.has(dateKey);

    let marker = '.';

    if (claimed) {
      marker = 'O';
    } else if (dateKey === todayDateKey) {
      marker = '*';
    } else if (dateKey < todayDateKey) {
      marker = '-';
    }

    currentRow.push(`${pad2(day)}${marker}`);

    if (currentRow.length === 7) {
      rows.push(currentRow.join(' '));
      currentRow.length = 0;
    }
  }

  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push('   ');
    }

    rows.push(currentRow.join(' '));
  }

  return [
    '일    월    화    수    목    금    토',
    ...rows,
  ].join('\n');
}

module.exports = {
  ATTENDANCE_TIMEZONE,
  ATTENDANCE_REWARDS,
  DEFAULT_DAILY_GOLD,
  getDateKeyInKST,
  getMonthMetaFromDateKey,
  shiftDateKey,
  calculateNextAttendanceStreak,
  getAttendanceReward,
  renderAttendanceCalendar,
};
