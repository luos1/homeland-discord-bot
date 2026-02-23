/**
 * ⚔️ Arena PvP System
 * 
 * 기능:
 * - 1:1 PvP 매칭
 * - ELO 시스템
 * - 보상 지급
 * - 랭킹
 */

const { prisma } = require('../database/prisma');

// 입장료
const ARENA_ENTRY_FEE = 100;

// ELO 변동 계산
function calculateEloChange(winnerElo, loserElo, kFactor = 32) {
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const winnerChange = Math.round(kFactor * (1 - expectedWin));
  const loserChange = Math.round(kFactor * (0 - (1 - expectedWin)));
  
  return { winnerChange, loserChange };
}

class ArenaSystem {
  /**
   * ELO 조회 또는 생성
   */
  static async getOrCreateElo(userId) {
    let elo = await prisma.playerElo.findUnique({
      where: { userId }
    });

    if (!elo) {
      elo = await prisma.playerElo.create({
        data: { userId, elo: 1000 }
      });
    }

    return elo;
  }

  /**
   * 매칭 (간단 버전: ELO ±200)
   */
  static async findMatch(userId) {
    const myElo = await this.getOrCreateElo(userId);
    
    // 대기 중인 유저들 중에서 ELO 비슷한 사람 찾기
    // 현재는 간단하게 랜덤 매칭
    const allElos = await prisma.playerElo.findMany({
      where: {
        userId: { not: userId },
        elo: {
          gte: myElo.elo - 200,
          lte: myElo.elo + 200
        }
      },
      take: 10
    });

    if (allElos.length === 0) {
      return null; // 매칭 실패
    }

    // 랜덤 선택
    const opponent = allElos[Math.floor(Math.random() * allElos.length)];
    return opponent;
  }

  /**
   * 전투 시작
   */
  static async startBattle(player1Id, player2Id) {
    // 1. 골드 확인
    const char1 = await prisma.character.findUnique({ where: { userId: player1Id } });
    const char2 = await prisma.character.findUnique({ where: { userId: player2Id } });

    if (!char1 || !char2) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    if (char1.gold < ARENA_ENTRY_FEE) {
      return { success: false, error: '골드가 부족합니다.' };
    }

    if (char2.gold < ARENA_ENTRY_FEE) {
      return { success: false, error: '상대방의 골드가 부족합니다.' };
    }

    // 2. ELO 조회
    const elo1 = await this.getOrCreateElo(player1Id);
    const elo2 = await this.getOrCreateElo(player2Id);

    try {
      // 3. 전투 생성 & 골드 차감
      const battle = await prisma.$transaction(async (tx) => {
        // 골드 차감
        await tx.character.update({
          where: { userId: player1Id },
          data: { gold: { decrement: ARENA_ENTRY_FEE } }
        });

        await tx.character.update({
          where: { userId: player2Id },
          data: { gold: { decrement: ARENA_ENTRY_FEE } }
        });

        // 전투 생성
        return await tx.arenaBattle.create({
          data: {
            player1Id,
            player2Id,
            player1Elo: elo1.elo,
            player2Elo: elo2.elo,
            entryFee: ARENA_ENTRY_FEE,
            reward: ARENA_ENTRY_FEE * 2
          }
        });
      });

      return { success: true, battle, elo1, elo2 };
    } catch (error) {
      console.error('Arena battle start error:', error);
      return { success: false, error: '전투 시작 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 전투 완료 & 보상
   */
  static async completeBattle(battleId, winnerId, battleData = null) {
    const battle = await prisma.arenaBattle.findUnique({
      where: { id: battleId }
    });

    if (!battle) {
      return { success: false, error: '전투를 찾을 수 없습니다.' };
    }

    if (battle.completedAt) {
      return { success: false, error: '이미 완료된 전투입니다.' };
    }

    if (winnerId !== battle.player1Id && winnerId !== battle.player2Id) {
      return { success: false, error: '잘못된 승자입니다.' };
    }

    const loserId = winnerId === battle.player1Id ? battle.player2Id : battle.player1Id;

    // ELO 변경 계산
    const winnerElo = winnerId === battle.player1Id ? battle.player1Elo : battle.player2Elo;
    const loserElo = loserId === battle.player1Id ? battle.player1Elo : battle.player2Elo;
    const { winnerChange, loserChange } = calculateEloChange(winnerElo, loserElo);

    try {
      await prisma.$transaction(async (tx) => {
        // 전투 완료 표시
        await tx.arenaBattle.update({
          where: { id: battleId },
          data: {
            winnerId,
            completedAt: new Date(),
            battleData: battleData
          }
        });

        // 승자 보상 & ELO
        await tx.character.update({
          where: { userId: winnerId },
          data: { 
            gold: { increment: battle.reward },
            xp: { increment: 50 } // 보너스 XP
          }
        });

        await tx.playerElo.update({
          where: { userId: winnerId },
          data: {
            elo: { increment: winnerChange },
            wins: { increment: 1 },
            lastBattleAt: new Date()
          }
        });

        // 패자 ELO & 위로 XP
        await tx.character.update({
          where: { userId: loserId },
          data: { xp: { increment: 10 } } // 위로 XP
        });

        await tx.playerElo.update({
          where: { userId: loserId },
          data: {
            elo: { increment: loserChange }, // 음수
            losses: { increment: 1 },
            lastBattleAt: new Date()
          }
        });
      });

      return { success: true, winnerChange, loserChange };
    } catch (error) {
      console.error('Arena complete error:', error);
      return { success: false, error: '전투 완료 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 주간 TOP 10 조회
   */
  static async getWeeklyTopPlayers(limit = 10) {
    return await prisma.playerElo.findMany({
      orderBy: { elo: 'desc' },
      take: limit
    });
  }

  /**
   * 유저 전투 기록
   */
  static async getUserBattles(userId, limit = 10) {
    return await prisma.arenaBattle.findMany({
      where: {
        OR: [
          { player1Id: userId },
          { player2Id: userId }
        ],
        completedAt: { not: null }
      },
      orderBy: { completedAt: 'desc' },
      take: limit
    });
  }
}

module.exports = { ArenaSystem, ARENA_ENTRY_FEE };
