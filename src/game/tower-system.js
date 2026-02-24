/**
 * Tower of Challengers System
 * 도전자의 탑 - 100층 도전 시스템
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ===== 탑 설정 =====

const TOWER_CONFIG = {
  maxFloor: 100,
  dailyTickets: 3,
  ticketCost: 1000,
  firstClearBonus: 2.0, // 첫 클리어 시 보상 2배
};

// ===== 층별 난이도 =====

function getFloorConfig(floor) {
  const isBoss = floor % 10 === 0;
  const baseLevel = Math.floor(floor / 2) + 5; // 1층=5, 10층=10, 100층=55
  
  return {
    floor,
    isBoss,
    monsterLevel: isBoss ? baseLevel + 5 : baseLevel,
    monsterName: isBoss ? `${floor}층 수호자` : `${floor}층 몬스터`,
    baseHP: isBoss ? 300 + floor * 20 : 150 + floor * 10,
    baseATK: isBoss ? 30 + floor * 2 : 20 + floor * 1,
    baseDEF: isBoss ? 15 + floor : 10 + Math.floor(floor / 2),
    goldReward: isBoss ? 500 + floor * 50 : 200 + floor * 10,
    expReward: isBoss ? 200 + floor * 10 : 100 + floor * 5,
  };
}

// ===== 보상 계산 =====

function calculateRewards(floor, isFirstClear) {
  const config = getFloorConfig(floor);
  const multiplier = isFirstClear ? TOWER_CONFIG.firstClearBonus : 1.0;
  
  const rewards = {
    gold: Math.floor(config.goldReward * multiplier),
    exp: Math.floor(config.expReward * multiplier),
  };
  
  // 보스 층 추가 보상
  if (config.isBoss) {
    // 10층마다 장비 드롭
    if (floor === 10) rewards.equipment = { rarity: 'uncommon', level: 10 };
    if (floor === 20) rewards.equipment = { rarity: 'rare', level: 20 };
    if (floor === 30) rewards.equipment = { rarity: 'rare', level: 30 };
    if (floor === 50) rewards.equipment = { rarity: 'epic', level: 40 };
    if (floor === 75) rewards.equipment = { rarity: 'epic', level: 50 };
    if (floor === 100) rewards.equipment = { rarity: 'legendary', level: 60 };
  }
  
  // 25층마다 스킬북
  if (floor % 25 === 0) {
    rewards.skillBook = true;
  }
  
  return rewards;
}

// ===== 티켓 구매 =====

async function buyTicket(characterId, quantity = 1) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
  });
  
  if (!character) {
    return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
  }
  
  // 오늘 사용한 티켓 수 확인
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayRuns = await prisma.towerRun.count({
    where: {
      characterId,
      createdAt: { gte: today },
    },
  });
  
  if (todayRuns + quantity > TOWER_CONFIG.dailyTickets) {
    return {
      success: false,
      error: `오늘은 ${TOWER_CONFIG.dailyTickets - todayRuns}회만 도전 가능합니다.`,
    };
  }
  
  const totalCost = TOWER_CONFIG.ticketCost * quantity;
  
  if (character.gold < totalCost) {
    return {
      success: false,
      error: `골드가 부족합니다. (${totalCost.toLocaleString()}G 필요)`,
    };
  }
  
  await prisma.character.update({
    where: { id: characterId },
    data: {
      gold: {
        decrement: totalCost,
      },
    },
  });
  
  return {
    success: true,
    message: `✅ 도전자의 탑 티켓 ${quantity}장 구매! (${totalCost.toLocaleString()}G)`,
    remainingTickets: TOWER_CONFIG.dailyTickets - todayRuns - quantity,
  };
}

// ===== 도전 시작 =====

async function startTowerRun(characterId) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
  });
  
  if (!character) {
    return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
  }
  
  // 오늘 도전 가능 횟수 확인
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayRuns = await prisma.towerRun.count({
    where: {
      characterId,
      createdAt: { gte: today },
    },
  });
  
  if (todayRuns >= TOWER_CONFIG.dailyTickets) {
    return { success: false, error: '오늘 도전 횟수를 모두 사용했습니다.' };
  }
  
  // 현재 최고 기록 조회
  const record = await prisma.towerRecord.findUnique({
    where: { characterId },
  });
  
  const startFloor = record ? record.highestFloor + 1 : 1;
  
  // 새 도전 생성
  const run = await prisma.towerRun.create({
    data: {
      characterId,
      startFloor,
      currentFloor: startFloor,
      active: true,
    },
  });
  
  return {
    success: true,
    run,
    floor: startFloor,
    config: getFloorConfig(startFloor),
  };
}

// ===== 층 도전 =====

async function challengeFloor(runId, characterId) {
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
  });
  
  if (!run || !run.active) {
    return { success: false, error: '진행 중인 도전이 없습니다.' };
  }
  
  if (run.characterId !== characterId) {
    return { success: false, error: '권한이 없습니다.' };
  }
  
  const floor = run.currentFloor;
  const config = getFloorConfig(floor);
  
  return {
    success: true,
    floor,
    config,
    runId,
  };
}

// ===== 층 클리어 =====

async function clearFloor(runId, characterId, victory) {
  const run = await prisma.towerRun.findUnique({
    where: { id: runId },
    include: { character: true },
  });
  
  if (!run || !run.active) {
    return { success: false, error: '진행 중인 도전이 없습니다.' };
  }
  
  if (run.characterId !== characterId) {
    return { success: false, error: '권한이 없습니다.' };
  }
  
  const floor = run.currentFloor;
  
  if (!victory) {
    // 실패: 도전 종료
    await prisma.towerRun.update({
      where: { id: runId },
      data: {
        active: false,
        endFloor: floor - 1,
      },
    });
    
    return {
      success: true,
      victory: false,
      message: `${floor}층에서 패배했습니다. 최종 층수: ${floor - 1}층`,
    };
  }
  
  // 성공: 보상 지급
  const record = await prisma.towerRecord.findUnique({
    where: { characterId },
  });
  
  const isFirstClear = !record || floor > record.highestFloor;
  const rewards = calculateRewards(floor, isFirstClear);
  
  // 보상 지급
  await prisma.character.update({
    where: { id: characterId },
    data: {
      gold: { increment: rewards.gold },
      experience: { increment: rewards.exp },
    },
  });
  
  // 기록 갱신
  if (isFirstClear) {
    if (record) {
      await prisma.towerRecord.update({
        where: { characterId },
        data: {
          highestFloor: floor,
          totalClears: { increment: 1 },
        },
      });
    } else {
      await prisma.towerRecord.create({
        data: {
          characterId,
          highestFloor: floor,
          totalClears: 1,
        },
      });
    }
  }
  
  if (floor >= TOWER_CONFIG.maxFloor) {
    // 100층 클리어!
    await prisma.towerRun.update({
      where: { id: runId },
      data: {
        active: false,
        endFloor: floor,
      },
    });
    
    return {
      success: true,
      victory: true,
      completed: true,
      message: `🎉 도전자의 탑 완주! 100층 클리어!`,
      rewards,
    };
  }
  
  // 다음 층으로
  await prisma.towerRun.update({
    where: { id: runId },
    data: {
      currentFloor: floor + 1,
    },
  });
  
  return {
    success: true,
    victory: true,
    floor,
    nextFloor: floor + 1,
    rewards,
    isFirstClear,
  };
}

// ===== 랭킹 조회 =====

async function getTowerRanking(limit = 10) {
  const records = await prisma.towerRecord.findMany({
    include: {
      character: {
        select: {
          name: true,
          level: true,
          class: true,
        },
      },
    },
    orderBy: [
      { highestFloor: 'desc' },
      { totalClears: 'desc' },
    ],
    take: limit,
  });
  
  return records;
}

// ===== 내 기록 조회 =====

async function getMyRecord(characterId) {
  const record = await prisma.towerRecord.findUnique({
    where: { characterId },
  });
  
  if (!record) {
    return {
      highestFloor: 0,
      totalClears: 0,
      rank: null,
    };
  }
  
  // 랭킹 계산
  const higherRecords = await prisma.towerRecord.count({
    where: {
      OR: [
        { highestFloor: { gt: record.highestFloor } },
        {
          highestFloor: record.highestFloor,
          totalClears: { gt: record.totalClears },
        },
      ],
    },
  });
  
  return {
    ...record,
    rank: higherRecords + 1,
  };
}

module.exports = {
  TOWER_CONFIG,
  getFloorConfig,
  calculateRewards,
  buyTicket,
  startTowerRun,
  challengeFloor,
  clearFloor,
  getTowerRanking,
  getMyRecord,
};
