/**
 * 🏰 Guild System
 * 
 * 기능:
 * - 길드 생성/해체
 * - 멤버 초대/가입/탈퇴/추방
 * - 역할 관리 (Master/Officer/Member)
 * - 길드 창고 (공유 자원)
 * - 길드 레벨링 & 버프
 * - 길드 NPC 소유 (수익 공유)
 */

const { prisma } = require('../database/prisma');

// 길드 생성 비용
const GUILD_CREATION_COST = 10000; // 10,000 골드

// 길드 레벨별 최대 인원
const GUILD_MAX_MEMBERS = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  10: 50,
  20: 100
};

// 길드 레벨업 필요 경험치
const GUILD_LEVEL_XP = {
  1: 1000,
  2: 2500,
  3: 5000,
  4: 10000,
  5: 20000,
  10: 100000,
  20: 500000
};

class GuildSystem {
  /**
   * 길드 생성
   */
  static async createGuild(userId, guildName, tag = null) {
    // 1. 캐릭터 조회
    const character = await prisma.character.findUnique({
      where: { userId }
    });

    if (!character) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    // 2. 골드 확인
    if (character.gold < GUILD_CREATION_COST) {
      return {
        success: false,
        error: `길드 생성 비용이 부족합니다. (필요: ${GUILD_CREATION_COST.toLocaleString()} 골드)`
      };
    }

    // 3. 이미 길드 소속인지 확인
    const existingMembership = await prisma.guildMember.findFirst({
      where: { userId }
    });

    if (existingMembership) {
      return { success: false, error: '이미 길드에 소속되어 있습니다.' };
    }

    // 4. 길드 이름 중복 확인
    const existingGuild = await prisma.guild.findUnique({
      where: { name: guildName }
    });

    if (existingGuild) {
      return { success: false, error: '이미 존재하는 길드 이름입니다.' };
    }

    // 5. 태그 중복 확인 (있을 경우)
    if (tag) {
      const existingTag = await prisma.guild.findUnique({
        where: { tag }
      });

      if (existingTag) {
        return { success: false, error: '이미 사용 중인 길드 태그입니다.' };
      }
    }

    try {
      // 6. 길드 생성 & 골드 차감 & 멤버 추가 (트랜잭션)
      const result = await prisma.$transaction(async (tx) => {
        // 길드 생성
        const guild = await tx.guild.create({
          data: {
            name: guildName,
            tag: tag,
            masterId: userId,
            level: 1,
            xp: 0,
            gold: 0,
            maxMembers: GUILD_MAX_MEMBERS[1]
          }
        });

        // 골드 차감
        await tx.character.update({
          where: { userId },
          data: { gold: { decrement: GUILD_CREATION_COST } }
        });

        // 마스터로 멤버 추가
        await tx.guildMember.create({
          data: {
            guildId: guild.id,
            userId,
            characterId: character.id,
            rank: 'MASTER'
          }
        });

        return guild;
      });

      return { success: true, guild: result };
    } catch (error) {
      console.error('Guild creation error:', error);
      return { success: false, error: '길드 생성 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 길드 정보 조회
   */
  static async getGuild(guildId) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: {
          orderBy: [
            { rank: 'asc' },
            { contributedXp: 'desc' }
          ]
        },
        storage: {
          where: { quantity: { gt: 0 } }
        },
        buffs: {
          where: { isActive: true }
        },
        npcs: true
      }
    });

    return guild;
  }

  /**
   * 유저의 길드 조회
   */
  static async getUserGuild(userId) {
    const membership = await prisma.guildMember.findFirst({
      where: { userId },
      include: {
        guild: {
          include: {
            members: {
              orderBy: [
                { rank: 'asc' },
                { contributedXp: 'desc' }
              ]
            }
          }
        }
      }
    });

    return membership?.guild || null;
  }

  /**
   * 유저의 길드 멤버십 조회
   */
  static async getUserMembership(userId) {
    return await prisma.guildMember.findFirst({
      where: { userId },
      include: { guild: true }
    });
  }

  /**
   * 길드 초대/가입
   */
  static async inviteMember(guildId, targetUserId, inviterUserId) {
    // 1. 초대자 권한 확인 (Master 또는 Officer)
    const inviter = await prisma.guildMember.findFirst({
      where: { guildId, userId: inviterUserId }
    });

    if (!inviter || (inviter.rank !== 'MASTER' && inviter.rank !== 'OFFICER')) {
      return { success: false, error: '멤버를 초대할 권한이 없습니다.' };
    }

    // 2. 대상 길드 소속 확인
    const existingMembership = await prisma.guildMember.findFirst({
      where: { userId: targetUserId }
    });

    if (existingMembership) {
      return { success: false, error: '이미 다른 길드에 소속되어 있습니다.' };
    }

    // 3. 길드 & 대상 캐릭터 조회
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { members: true }
    });

    const targetCharacter = await prisma.character.findUnique({
      where: { userId: targetUserId }
    });

    if (!targetCharacter) {
      return { success: false, error: '대상 캐릭터를 찾을 수 없습니다.' };
    }

    // 4. 최대 인원 확인
    if (guild.members.length >= guild.maxMembers) {
      return { success: false, error: '길드 인원이 가득 찼습니다.' };
    }

    // 5. 최소 레벨 확인
    if (targetCharacter.level < guild.minLevel) {
      return {
        success: false,
        error: `레벨 ${guild.minLevel} 이상만 가입할 수 있습니다.`
      };
    }

    try {
      // 6. 멤버 추가
      const member = await prisma.guildMember.create({
        data: {
          guildId,
          userId: targetUserId,
          characterId: targetCharacter.id,
          rank: 'MEMBER'
        }
      });

      return { success: true, member };
    } catch (error) {
      console.error('Guild invite error:', error);
      return { success: false, error: '초대 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 길드 탈퇴
   */
  static async leavGuild(userId) {
    const membership = await prisma.guildMember.findFirst({
      where: { userId },
      include: { guild: true }
    });

    if (!membership) {
      return { success: false, error: '길드에 소속되어 있지 않습니다.' };
    }

    // 마스터는 탈퇴 불가 (위임 먼저 필요)
    if (membership.rank === 'MASTER') {
      return {
        success: false,
        error: '길드 마스터는 탈퇴할 수 없습니다. 마스터 위임 후 탈퇴하세요.'
      };
    }

    try {
      await prisma.guildMember.delete({
        where: { id: membership.id }
      });

      return { success: true };
    } catch (error) {
      console.error('Guild leave error:', error);
      return { success: false, error: '탈퇴 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 멤버 추방
   */
  static async kickMember(guildId, targetUserId, kickerUserId) {
    // 1. 추방자 권한 확인
    const kicker = await prisma.guildMember.findFirst({
      where: { guildId, userId: kickerUserId }
    });

    if (!kicker || (kicker.rank !== 'MASTER' && kicker.rank !== 'OFFICER')) {
      return { success: false, error: '멤버를 추방할 권한이 없습니다.' };
    }

    // 2. 대상 조회
    const target = await prisma.guildMember.findFirst({
      where: { guildId, userId: targetUserId }
    });

    if (!target) {
      return { success: false, error: '해당 멤버를 찾을 수 없습니다.' };
    }

    // 3. 마스터 추방 불가
    if (target.rank === 'MASTER') {
      return { success: false, error: '길드 마스터는 추방할 수 없습니다.' };
    }

    // 4. Officer는 Officer 추방 불가
    if (kicker.rank === 'OFFICER' && target.rank === 'OFFICER') {
      return { success: false, error: 'Officer는 다른 Officer를 추방할 수 없습니다.' };
    }

    try {
      await prisma.guildMember.delete({
        where: { id: target.id }
      });

      return { success: true };
    } catch (error) {
      console.error('Guild kick error:', error);
      return { success: false, error: '추방 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 역할 변경
   */
  static async changeRank(guildId, targetUserId, newRank, changerUserId) {
    // 1. 변경자 권한 확인 (Master만 가능)
    const changer = await prisma.guildMember.findFirst({
      where: { guildId, userId: changerUserId }
    });

    if (!changer || changer.rank !== 'MASTER') {
      return { success: false, error: '역할을 변경할 권한이 없습니다.' };
    }

    // 2. 대상 조회
    const target = await prisma.guildMember.findFirst({
      where: { guildId, userId: targetUserId }
    });

    if (!target) {
      return { success: false, error: '해당 멤버를 찾을 수 없습니다.' };
    }

    // 3. 자기 자신 변경 불가
    if (targetUserId === changerUserId) {
      return { success: false, error: '자신의 역할은 변경할 수 없습니다.' };
    }

    // 4. 유효한 역할 확인
    if (!['MASTER', 'OFFICER', 'MEMBER'].includes(newRank)) {
      return { success: false, error: '유효하지 않은 역할입니다.' };
    }

    try {
      await prisma.guildMember.update({
        where: { id: target.id },
        data: { rank: newRank }
      });

      return { success: true };
    } catch (error) {
      console.error('Guild rank change error:', error);
      return { success: false, error: '역할 변경 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 마스터 위임
   */
  static async transferMaster(guildId, newMasterId, currentMasterId) {
    // 1. 현재 마스터 확인
    const currentMaster = await prisma.guildMember.findFirst({
      where: { guildId, userId: currentMasterId }
    });

    if (!currentMaster || currentMaster.rank !== 'MASTER') {
      return { success: false, error: '길드 마스터만 위임할 수 있습니다.' };
    }

    // 2. 새 마스터 확인
    const newMaster = await prisma.guildMember.findFirst({
      where: { guildId, userId: newMasterId }
    });

    if (!newMaster) {
      return { success: false, error: '해당 멤버를 찾을 수 없습니다.' };
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 현재 마스터 → Officer
        await tx.guildMember.update({
          where: { id: currentMaster.id },
          data: { rank: 'OFFICER' }
        });

        // 새 마스터 → Master
        await tx.guildMember.update({
          where: { id: newMaster.id },
          data: { rank: 'MASTER' }
        });

        // 길드 masterId 변경
        await tx.guild.update({
          where: { id: guildId },
          data: { masterId: newMasterId }
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Guild transfer master error:', error);
      return { success: false, error: '마스터 위임 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 길드 해체
   */
  static async disbandGuild(guildId, userId) {
    // 1. 마스터 확인
    const master = await prisma.guildMember.findFirst({
      where: { guildId, userId }
    });

    if (!master || master.rank !== 'MASTER') {
      return { success: false, error: '길드 마스터만 해체할 수 있습니다.' };
    }

    try {
      // 길드 삭제 (Cascade로 멤버, 창고, 버프, NPC 모두 삭제됨)
      await prisma.guild.delete({
        where: { id: guildId }
      });

      return { success: true };
    } catch (error) {
      console.error('Guild disband error:', error);
      return { success: false, error: '길드 해체 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 길드 경험치 기여
   */
  static async contributeXp(userId, xp) {
    const membership = await prisma.guildMember.findFirst({
      where: { userId },
      include: { guild: true }
    });

    if (!membership) return;

    try {
      await prisma.$transaction(async (tx) => {
        // 길드 XP 증가
        await tx.guild.update({
          where: { id: membership.guildId },
          data: { xp: { increment: xp } }
        });

        // 멤버 기여도 증가
        await tx.guildMember.update({
          where: { id: membership.id },
          data: { contributedXp: { increment: xp } }
        });
      });

      // 레벨업 체크
      await this.checkLevelUp(membership.guildId);
    } catch (error) {
      console.error('Guild XP contribution error:', error);
    }
  }

  /**
   * 길드 골드 기여
   */
  static async contributeGold(userId, gold) {
    const membership = await prisma.guildMember.findFirst({
      where: { userId }
    });

    if (!membership) return { success: false, error: '길드에 소속되어 있지 않습니다.' };

    const character = await prisma.character.findUnique({
      where: { userId }
    });

    if (character.gold < gold) {
      return { success: false, error: '골드가 부족합니다.' };
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 캐릭터 골드 차감
        await tx.character.update({
          where: { userId },
          data: { gold: { decrement: gold } }
        });

        // 길드 골드 증가
        await tx.guild.update({
          where: { id: membership.guildId },
          data: { gold: { increment: gold } }
        });

        // 멤버 기여도 증가
        await tx.guildMember.update({
          where: { id: membership.id },
          data: { contributedGold: { increment: gold } }
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Guild gold contribution error:', error);
      return { success: false, error: '골드 기여 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 길드 레벨업 체크
   */
  static async checkLevelUp(guildId) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId }
    });

    const requiredXp = GUILD_LEVEL_XP[guild.level] || 999999999;

    if (guild.xp >= requiredXp) {
      const newLevel = guild.level + 1;
      const newMaxMembers = GUILD_MAX_MEMBERS[newLevel] || guild.maxMembers + 5;

      await prisma.guild.update({
        where: { id: guildId },
        data: {
          level: newLevel,
          maxMembers: newMaxMembers
        }
      });

      return { leveledUp: true, newLevel };
    }

    return { leveledUp: false };
  }

  /**
   * 길드 목록 조회 (모집 중)
   */
  static async getRecruitingGuilds(limit = 20) {
    return await prisma.guild.findMany({
      where: { isRecruiting: true },
      include: {
        members: true,
        _count: {
          select: { members: true }
        }
      },
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' }
      ],
      take: limit
    });
  }
}

module.exports = { GuildSystem, GUILD_CREATION_COST };
