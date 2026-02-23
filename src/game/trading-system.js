/**
 * 🤝 1:1 Trading System
 * 
 * 기능:
 * - 플레이어 간 직접 거래
 * - 아이템 + 골드 교환
 * - 거래 확인 시스템 (양측 동의)
 * - 거래 취소
 * - 거래 타임아웃 (5분)
 */

const { prisma } = require('../database/prisma');

// 진행 중인 거래 (메모리)
const activeTrades = new Map();

// 거래 타임아웃 (5분)
const TRADE_TIMEOUT = 5 * 60 * 1000;

class TradingSystem {
  /**
   * 거래 시작
   */
  static async startTrade(userId1, userId2) {
    // 1. 자기 자신과 거래 불가
    if (userId1 === userId2) {
      return { success: false, error: '자기 자신과 거래할 수 없습니다.' };
    }

    // 2. 이미 거래 중인지 확인
    if (this.isUserInTrade(userId1)) {
      return { success: false, error: '이미 거래 중입니다.' };
    }

    if (this.isUserInTrade(userId2)) {
      return { success: false, error: '상대방이 이미 거래 중입니다.' };
    }

    // 3. 캐릭터 존재 확인
    const char1 = await prisma.character.findUnique({ where: { userId: userId1 } });
    const char2 = await prisma.character.findUnique({ where: { userId: userId2 } });

    if (!char1 || !char2) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    // 4. 거래 생성
    const tradeId = `${userId1}_${userId2}_${Date.now()}`;
    const trade = {
      id: tradeId,
      user1: {
        userId: userId1,
        items: [],
        gold: 0,
        confirmed: false
      },
      user2: {
        userId: userId2,
        items: [],
        gold: 0,
        confirmed: false
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + TRADE_TIMEOUT
    };

    activeTrades.set(tradeId, trade);

    // 5. 타임아웃 설정
    setTimeout(() => {
      if (activeTrades.has(tradeId)) {
        const trade = activeTrades.get(tradeId);
        if (!trade.user1.confirmed || !trade.user2.confirmed) {
          activeTrades.delete(tradeId);
        }
      }
    }, TRADE_TIMEOUT);

    return { success: true, tradeId, trade };
  }

  /**
   * 거래 조회
   */
  static getTrade(tradeId) {
    return activeTrades.get(tradeId);
  }

  /**
   * 유저의 거래 조회
   */
  static getUserTrade(userId) {
    for (const [tradeId, trade] of activeTrades.entries()) {
      if (trade.user1.userId === userId || trade.user2.userId === userId) {
        return { tradeId, trade };
      }
    }
    return null;
  }

  /**
   * 유저가 거래 중인지 확인
   */
  static isUserInTrade(userId) {
    return this.getUserTrade(userId) !== null;
  }

  /**
   * 아이템 추가
   */
  static async addItem(tradeId, userId, equipmentId) {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: '거래를 찾을 수 없습니다.' };
    }

    // 어느 쪽 유저인지 확인
    const side = trade.user1.userId === userId ? 'user1' : 'user2';
    if (trade[side].userId !== userId) {
      return { success: false, error: '잘못된 거래입니다.' };
    }

    // 장비 소유 확인
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId }
    });

    if (!equipment || equipment.characterId !== (await prisma.character.findUnique({ where: { userId } })).id) {
      return { success: false, error: '해당 아이템을 소유하고 있지 않습니다.' };
    }

    // 이미 추가했는지 확인
    if (trade[side].items.some(item => item.id === equipmentId)) {
      return { success: false, error: '이미 추가된 아이템입니다.' };
    }

    // 아이템 추가
    trade[side].items.push({
      id: equipmentId,
      name: equipment.name,
      tier: equipment.tier
    });

    // 확인 상태 초기화
    trade.user1.confirmed = false;
    trade.user2.confirmed = false;

    return { success: true, trade };
  }

  /**
   * 아이템 제거
   */
  static removeItem(tradeId, userId, equipmentId) {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: '거래를 찾을 수 없습니다.' };
    }

    const side = trade.user1.userId === userId ? 'user1' : 'user2';
    if (trade[side].userId !== userId) {
      return { success: false, error: '잘못된 거래입니다.' };
    }

    // 아이템 제거
    trade[side].items = trade[side].items.filter(item => item.id !== equipmentId);

    // 확인 상태 초기화
    trade.user1.confirmed = false;
    trade.user2.confirmed = false;

    return { success: true, trade };
  }

  /**
   * 골드 설정
   */
  static async setGold(tradeId, userId, gold) {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: '거래를 찾을 수 없습니다.' };
    }

    const side = trade.user1.userId === userId ? 'user1' : 'user2';
    if (trade[side].userId !== userId) {
      return { success: false, error: '잘못된 거래입니다.' };
    }

    // 골드 확인
    const character = await prisma.character.findUnique({ where: { userId } });
    if (character.gold < gold) {
      return { success: false, error: '골드가 부족합니다.' };
    }

    // 골드 설정
    trade[side].gold = gold;

    // 확인 상태 초기화
    trade.user1.confirmed = false;
    trade.user2.confirmed = false;

    return { success: true, trade };
  }

  /**
   * 거래 확인
   */
  static async confirmTrade(tradeId, userId) {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: '거래를 찾을 수 없습니다.' };
    }

    const side = trade.user1.userId === userId ? 'user1' : 'user2';
    if (trade[side].userId !== userId) {
      return { success: false, error: '잘못된 거래입니다.' };
    }

    // 확인 표시
    trade[side].confirmed = true;

    // 양측 모두 확인했으면 거래 완료
    if (trade.user1.confirmed && trade.user2.confirmed) {
      const result = await this.executeTrade(tradeId);
      if (result.success) {
        activeTrades.delete(tradeId);
      }
      return result;
    }

    return { success: true, trade, waitingForOther: true };
  }

  /**
   * 거래 실행
   */
  static async executeTrade(tradeId) {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: '거래를 찾을 수 없습니다.' };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const char1 = await tx.character.findUnique({ where: { userId: trade.user1.userId } });
        const char2 = await tx.character.findUnique({ where: { userId: trade.user2.userId } });

        // 골드 확인
        if (char1.gold < trade.user1.gold) {
          throw new Error('User1 골드 부족');
        }
        if (char2.gold < trade.user2.gold) {
          throw new Error('User2 골드 부족');
        }

        // 아이템 소유 확인
        for (const item of trade.user1.items) {
          const equipment = await tx.equipment.findUnique({ where: { id: item.id } });
          if (!equipment || equipment.characterId !== char1.id) {
            throw new Error(`User1 아이템 소유 실패: ${item.name}`);
          }
        }

        for (const item of trade.user2.items) {
          const equipment = await tx.equipment.findUnique({ where: { id: item.id } });
          if (!equipment || equipment.characterId !== char2.id) {
            throw new Error(`User2 아이템 소유 실패: ${item.name}`);
          }
        }

        // 골드 교환
        await tx.character.update({
          where: { userId: trade.user1.userId },
          data: { gold: { decrement: trade.user1.gold, increment: trade.user2.gold } }
        });

        await tx.character.update({
          where: { userId: trade.user2.userId },
          data: { gold: { decrement: trade.user2.gold, increment: trade.user1.gold } }
        });

        // 아이템 교환
        for (const item of trade.user1.items) {
          await tx.equipment.update({
            where: { id: item.id },
            data: { characterId: char2.id }
          });
        }

        for (const item of trade.user2.items) {
          await tx.equipment.update({
            where: { id: item.id },
            data: { characterId: char1.id }
          });
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Trade execution error:', error);
      return { success: false, error: error.message || '거래 실행 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 거래 취소
   */
  static cancelTrade(tradeId, userId) {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: '거래를 찾을 수 없습니다.' };
    }

    if (trade.user1.userId !== userId && trade.user2.userId !== userId) {
      return { success: false, error: '잘못된 거래입니다.' };
    }

    activeTrades.delete(tradeId);
    return { success: true };
  }

  /**
   * 만료된 거래 정리
   */
  static cleanupExpiredTrades() {
    const now = Date.now();
    for (const [tradeId, trade] of activeTrades.entries()) {
      if (trade.expiresAt < now) {
        activeTrades.delete(tradeId);
      }
    }
  }
}

// 정기적으로 만료된 거래 정리 (1분마다)
setInterval(() => {
  TradingSystem.cleanupExpiredTrades();
}, 60000);

module.exports = { TradingSystem };
