/**
 * PvP 시스템
 * 
 * - 플레이어 대 플레이어 전투
 * - 랭킹 시스템
 * - 시즌 보상
 */

const { EmbedBuilder } = require('discord.js');

// PvP 매칭 대기열
const matchQueue = new Map();

// 활성 PvP 전투
const activeBattles = new Map();

// PvP 랭킹 (메모리)
let pvpRankings = [];

/**
 * PvP 매칭 대기열 참가
 */
async function joinPvPQueue(userId, character) {
  if (matchQueue.has(userId)) {
    return { success: false, error: '이미 매칭 대기 중입니다.' };
  }
  
  if (isInBattle(userId)) {
    return { success: false, error: '이미 전투 중입니다.' };
  }
  
  matchQueue.set(userId, {
    userId,
    character,
    joinedAt: Date.now(),
    rating: character.pvpRating || 1000
  });
  
  // 매칭 시도
  const opponent = findOpponent(userId, character);
  
  if (opponent) {
    // 매칭 성공
    matchQueue.delete(userId);
    matchQueue.delete(opponent.userId);
    
    const battleId = createBattle(userId, opponent.userId, character, opponent.character);
    
    return {
      success: true,
      matched: true,
      battleId,
      opponent: opponent.character
    };
  }
  
  return {
    success: true,
    matched: false,
    queueSize: matchQueue.size
  };
}

/**
 * 상대 찾기 (레이팅 기반 매칭)
 */
function findOpponent(userId, character) {
  const myRating = character.pvpRating || 1000;
  const ratingRange = 200; // ±200 레이팅 내에서 매칭
  
  for (const [opponentId, data] of matchQueue.entries()) {
    if (opponentId === userId) continue;
    
    const ratingDiff = Math.abs(data.rating - myRating);
    if (ratingDiff <= ratingRange) {
      return data;
    }
  }
  
  return null;
}

/**
 * PvP 전투 생성
 */
function createBattle(userId1, userId2, char1, char2) {
  const battleId = `pvp_${userId1}_${userId2}_${Date.now()}`;
  
  const battle = {
    id: battleId,
    player1: {
      userId: userId1,
      character: char1,
      hp: char1.maxHp,
      mana: char1.maxMana || 0
    },
    player2: {
      userId: userId2,
      character: char2,
      hp: char2.maxHp,
      mana: char2.maxMana || 0
    },
    turn: 1,
    currentTurn: userId1, // 플레이어 1이 선공
    status: 'ongoing',
    startedAt: Date.now()
  };
  
  activeBattles.set(battleId, battle);
  
  return battleId;
}

/**
 * PvP 전투 진행 중 체크
 */
function isInBattle(userId) {
  for (const battle of activeBattles.values()) {
    if (battle.player1.userId === userId || battle.player2.userId === userId) {
      return true;
    }
  }
  return false;
}

/**
 * PvP 전투 조회
 */
function getBattle(battleId) {
  return activeBattles.get(battleId);
}

/**
 * PvP 행동 실행
 */
async function executePvPAction(battleId, userId, action, skillKey = null) {
  const battle = activeBattles.get(battleId);
  
  if (!battle) {
    return { success: false, error: '전투를 찾을 수 없습니다.' };
  }
  
  if (battle.currentTurn !== userId) {
    return { success: false, error: '당신의 턴이 아닙니다.' };
  }
  
  const isPlayer1 = battle.player1.userId === userId;
  const attacker = isPlayer1 ? battle.player1 : battle.player2;
  const defender = isPlayer1 ? battle.player2 : battle.player1;
  
  const log = [];
  
  // 간단한 데미지 계산 (실제로는 combat.js 로직 재사용)
  const damage = Math.max(1, attacker.character.attack - defender.character.defense);
  defender.hp = Math.max(0, defender.hp - damage);
  
  log.push(`⚔️ ${attacker.character.name}의 공격!`);
  log.push(`💔 ${damage} 데미지!`);
  
  // 승부 판정
  if (defender.hp <= 0) {
    battle.status = 'finished';
    battle.winner = userId;
    
    log.push('');
    log.push('🏆 승리!');
    
    // 레이팅 업데이트
    await updateRatings(attacker.userId, defender.userId, attacker.character.pvpRating || 1000, defender.character.pvpRating || 1000);
    
    activeBattles.delete(battleId);
    
    return {
      success: true,
      status: 'victory',
      log,
      battle
    };
  }
  
  // 턴 넘김
  battle.currentTurn = isPlayer1 ? battle.player2.userId : battle.player1.userId;
  battle.turn++;
  
  return {
    success: true,
    status: 'ongoing',
    log,
    battle
  };
}

/**
 * 레이팅 업데이트 (ELO 방식)
 */
async function updateRatings(winnerId, loserId, winnerRating, loserRating) {
  const K = 32; // K-factor
  
  const expectedWin = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLose = 1 - expectedWin;
  
  const newWinnerRating = Math.floor(winnerRating + K * (1 - expectedWin));
  const newLoserRating = Math.floor(loserRating + K * (0 - expectedLose));
  
  // 여기서 prisma로 실제 업데이트 (현재는 메모리만)
  // await prisma.character.update({ ... });
  
  return {
    winner: { old: winnerRating, new: newWinnerRating, change: newWinnerRating - winnerRating },
    loser: { old: loserRating, new: newLoserRating, change: newLoserRating - loserRating }
  };
}

/**
 * PvP 랭킹 조회
 */
async function getPvPRankings(limit = 10) {
  // 실제로는 prisma에서 조회
  // const rankings = await prisma.character.findMany({
  //   orderBy: { pvpRating: 'desc' },
  //   take: limit
  // });
  
  return pvpRankings.slice(0, limit);
}

/**
 * 매칭 대기열 떠나기
 */
function leaveQueue(userId) {
  matchQueue.delete(userId);
  return { success: true };
}

module.exports = {
  joinPvPQueue,
  leaveQueue,
  getBattle,
  executePvPAction,
  getPvPRankings,
  isInBattle
};
