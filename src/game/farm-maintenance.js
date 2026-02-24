/**
 * Farm Maintenance System
 * 유지비 자동 결제 + NPC 도적 습격
 */

const { PrismaClient } = require('@prisma/client');
const { FIELD_TYPES } = require('./farm-fields');

const prisma = new PrismaClient();

// ===== 유지비 자동 결제 =====

async function collectMaintenanceFees() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 24시간 이상 지난 필드 조회
  const fields = await prisma.farmField.findMany({
    where: {
      ownerId: { not: null },
      OR: [
        { lastPaid: null },
        { lastPaid: { lt: oneDayAgo } },
      ],
    },
    include: {
      owner: true,
    },
  });

  let collected = 0;
  let abandoned = 0;

  for (const field of fields) {
    if (!field.owner) continue;

    const config = FIELD_TYPES[field.fieldType];
    const fee = config.dailyFee;

    if (field.owner.gold >= fee) {
      // 유지비 결제
      await prisma.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: field.ownerId },
          data: {
            gold: {
              decrement: fee,
            },
          },
        });

        await tx.farmField.update({
          where: { id: field.id },
          data: {
            lastPaid: now,
          },
        });
      });

      collected++;
    } else {
      // 골드 부족 → 필드 몰수
      await prisma.farmField.update({
        where: { id: field.id },
        data: {
          ownerId: null,
          claimedAt: null,
          lastPaid: null,
          cropType: null,
          plantedAt: null,
          harvestAt: null,
          waterCount: 0,
        },
      });

      abandoned++;
    }
  }

  console.log(`[Farm] Maintenance: ${collected} paid, ${abandoned} abandoned`);

  return { collected, abandoned };
}

// ===== NPC 도적 습격 =====

async function spawnRaiders() {
  // 작물이 심어진 필드 조회
  const fields = await prisma.farmField.findMany({
    where: {
      ownerId: { not: null },
      cropType: { not: null },
    },
    include: {
      owner: true,
    },
  });

  let raids = 0;
  let defended = 0;

  for (const field of fields) {
    // 30% 확률로 습격
    if (Math.random() > 0.3) continue;

    // 경비 보호 체크
    const hasGuard = field.owner?.specialRole === 'guard';
    const defenseChance = hasGuard ? 0.7 : 0.5; // 경비: 70%, 일반: 50%

    const success = Math.random() > defenseChance;

    if (success) {
      // 습격 성공: 작물 50% 손실 + 수확 시간 +2시간
      const harvestAt = field.harvestAt
        ? new Date(new Date(field.harvestAt).getTime() + 2 * 60 * 60 * 1000)
        : null;

      await prisma.$transaction(async (tx) => {
        await tx.farmField.update({
          where: { id: field.id },
          data: {
            harvestAt,
          },
        });

        await tx.fieldRaid.create({
          data: {
            fieldId: field.id,
            raiderId: null, // NPC 도적
            success: true,
            stolenAmount: 50, // 50% 손실
          },
        });
      });

      raids++;
    } else {
      // 습격 실패 (방어 성공)
      await prisma.fieldRaid.create({
        data: {
          fieldId: field.id,
          raiderId: null,
          success: false,
          stolenAmount: 0,
        },
      });

      defended++;
    }
  }

  console.log(`[Farm] Raids: ${raids} successful, ${defended} defended`);

  return { raids, defended };
}

// ===== 경비 순찰 보상 =====

async function distributeGuardRewards() {
  // 경비 역할을 가진 캐릭터 조회
  const guards = await prisma.character.findMany({
    where: {
      specialRole: 'guard',
    },
  });

  let rewards = 0;

  for (const guard of guards) {
    // 오늘 방어한 습격 횟수 조회
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const defenses = await prisma.fieldRaid.count({
      where: {
        raidedAt: { gte: today },
        success: false,
        field: {
          ownerId: guard.id,
        },
      },
    });

    if (defenses > 0) {
      // 방어 1회당 100G
      const reward = defenses * 100;

      await prisma.character.update({
        where: { id: guard.id },
        data: {
          gold: {
            increment: reward,
          },
        },
      });

      rewards++;
    }
  }

  console.log(`[Farm] Guard rewards: ${rewards} guards paid`);

  return { rewards };
}

// ===== 일괄 실행 =====

async function runDailyMaintenance() {
  console.log('[Farm] Running daily maintenance...');

  try {
    const fees = await collectMaintenanceFees();
    const raids = await spawnRaiders();
    const guards = await distributeGuardRewards();

    console.log('[Farm] Daily maintenance complete:', { fees, raids, guards });

    return { fees, raids, guards };
  } catch (error) {
    console.error('[Farm] Daily maintenance error:', error);
    throw error;
  }
}

module.exports = {
  collectMaintenanceFees,
  spawnRaiders,
  distributeGuardRewards,
  runDailyMaintenance,
};
