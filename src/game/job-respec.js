const { PRODUCTION_CLASSES } = require('./production-classes');
const { localizeClassName } = require('../utils/ui');

const JOB_TYPES = Object.freeze({
  combat: 'combat',
  production: 'production',
});

const JOB_RESPEC_BASE_COST = Object.freeze({
  [JOB_TYPES.combat]: 5000,
  [JOB_TYPES.production]: 3000,
});

const JOB_RESPEC_LOOKBACK_DAYS = 7;
const JOB_RESPEC_MULTIPLIER_MIN = 0.5;
const JOB_RESPEC_MULTIPLIER_MAX = 2.0;

const COMBAT_CLASS_KEYS = Object.freeze(['warrior', 'ranger', 'sorcerer']);

const COMBAT_CLASS_ALIASES = Object.freeze({
  warrior: 'warrior',
  ranger: 'ranger',
  sorcerer: 'sorcerer',
  mage: 'sorcerer',
  전사: 'warrior',
  궁수: 'ranger',
  마법사: 'sorcerer',
});

const COMBAT_CLASS_LABELS = Object.freeze({
  warrior: '전사',
  ranger: '궁수',
  sorcerer: '마법사',
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeJobType(jobType) {
  const normalized = String(jobType || '').trim().toLowerCase();
  return Object.values(JOB_TYPES).includes(normalized) ? normalized : null;
}

function normalizeCombatClass(jobClass) {
  const normalized = String(jobClass || '').trim().toLowerCase();
  return COMBAT_CLASS_ALIASES[normalized] || null;
}

function normalizeProductionClass(jobClass) {
  const normalized = String(jobClass || '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return PRODUCTION_CLASSES[normalized] ? normalized : null;
}

function normalizeJobClass(jobType, jobClass) {
  const normalizedType = normalizeJobType(jobType);

  if (!normalizedType) {
    return null;
  }

  if (normalizedType === JOB_TYPES.combat) {
    return normalizeCombatClass(jobClass);
  }

  return normalizeProductionClass(jobClass);
}

function localizeCombatClassKey(combatClass) {
  const normalized = normalizeCombatClass(combatClass);

  if (!normalized) {
    return localizeClassName(combatClass);
  }

  return COMBAT_CLASS_LABELS[normalized] || localizeClassName(normalized);
}

function getProductionClassName(productionClass) {
  const normalized = normalizeProductionClass(productionClass);

  if (!normalized) {
    return productionClass;
  }

  return PRODUCTION_CLASSES[normalized]?.name || normalized;
}

function getProductionClassEmoji(productionClass) {
  const normalized = normalizeProductionClass(productionClass);

  if (!normalized) {
    return '🔨';
  }

  return PRODUCTION_CLASSES[normalized]?.emoji || '🔨';
}

function getCombatRespecClassKeys() {
  return [...COMBAT_CLASS_KEYS];
}

function getProductionRespecClassKeys() {
  return Object.keys(PRODUCTION_CLASSES);
}

function resolvePrismaClient(prismaClient) {
  if (prismaClient) {
    return prismaClient;
  }

  const { prisma } = require('../database/client');
  return prisma;
}

function getSessionCount(sessionValue) {
  if (Array.isArray(sessionValue)) {
    return sessionValue.length;
  }

  return sessionValue ? 1 : 0;
}

function canRespec(character) {
  if (!character) {
    return {
      allowed: false,
      reason: '캐릭터가 없습니다.',
    };
  }

  if (character.combatSession) {
    return {
      allowed: false,
      reason: '전투 중에는 재전직할 수 없습니다.',
    };
  }

  const gatheringCount = getSessionCount(character.gatherSessions);
  const craftingCount = getSessionCount(character.craftingSessions);

  if (gatheringCount > 0 || craftingCount > 0) {
    return {
      allowed: false,
      reason: '생산 중에는 재전직할 수 없습니다.',
    };
  }

  return {
    allowed: true,
  };
}

function buildDemandClassPool(jobType, recentHistory) {
  const classPool = new Set(
    jobType === JOB_TYPES.combat
      ? COMBAT_CLASS_KEYS
      : getProductionRespecClassKeys(),
  );

  const rows = Array.isArray(recentHistory) ? recentHistory : [];

  for (const row of rows) {
    if (normalizeJobType(row?.jobType) !== jobType) {
      continue;
    }

    const normalizedClass = normalizeJobClass(jobType, row?.toClass);

    if (normalizedClass) {
      classPool.add(normalizedClass);
    }
  }

  return [...classPool];
}

async function refreshJobRespecDemand(prismaClient = null, { now = new Date() } = {}) {
  const prisma = resolvePrismaClient(prismaClient);
  const lookbackMs = JOB_RESPEC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - lookbackMs);

  const recentHistory = await prisma.jobRespecHistory.findMany({
    where: {
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      jobType: true,
      toClass: true,
    },
  });

  const countsByType = {
    [JOB_TYPES.combat]: new Map(),
    [JOB_TYPES.production]: new Map(),
  };

  for (const row of recentHistory) {
    const type = normalizeJobType(row.jobType);

    if (!type) {
      continue;
    }

    const normalizedClass = normalizeJobClass(type, row.toClass);

    if (!normalizedClass) {
      continue;
    }

    const current = countsByType[type].get(normalizedClass) || 0;
    countsByType[type].set(normalizedClass, current + 1);
  }

  const upserts = [];

  for (const type of Object.values(JOB_TYPES)) {
    const classPool = buildDemandClassPool(type, recentHistory);

    if (classPool.length === 0) {
      continue;
    }

    const total = classPool.reduce((sum, jobClass) => {
      return sum + (countsByType[type].get(jobClass) || 0);
    }, 0);

    const average = total > 0 ? total / classPool.length : 0;

    for (const jobClass of classPool) {
      const count = countsByType[type].get(jobClass) || 0;
      const multiplier = average > 0
        ? clamp(count / average, JOB_RESPEC_MULTIPLIER_MIN, JOB_RESPEC_MULTIPLIER_MAX)
        : 1.0;
      const roundedMultiplier = Number(multiplier.toFixed(4));

      upserts.push(
        prisma.jobRespecDemand.upsert({
          where: {
            jobType_jobClass: {
              jobType: type,
              jobClass,
            },
          },
          update: {
            respecCount: count,
            multiplier: roundedMultiplier,
          },
          create: {
            jobType: type,
            jobClass,
            respecCount: count,
            multiplier: roundedMultiplier,
          },
        }),
      );
    }
  }

  return Promise.all(upserts);
}

function resolveMultiplier(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1.0;
  }

  return clamp(parsed, JOB_RESPEC_MULTIPLIER_MIN, JOB_RESPEC_MULTIPLIER_MAX);
}

async function getJobRespecCost(jobType, toClass, prismaClient = null) {
  const normalizedType = normalizeJobType(jobType);
  const normalizedClass = normalizeJobClass(normalizedType, toClass);

  if (!normalizedType || !normalizedClass) {
    return null;
  }

  const baseCost = JOB_RESPEC_BASE_COST[normalizedType];

  if (!baseCost) {
    return null;
  }

  const prisma = resolvePrismaClient(prismaClient);

  let demand = await prisma.jobRespecDemand.findUnique({
    where: {
      jobType_jobClass: {
        jobType: normalizedType,
        jobClass: normalizedClass,
      },
    },
    select: {
      multiplier: true,
    },
  });

  if (!demand) {
    await refreshJobRespecDemand(prisma);

    demand = await prisma.jobRespecDemand.findUnique({
      where: {
        jobType_jobClass: {
          jobType: normalizedType,
          jobClass: normalizedClass,
        },
      },
      select: {
        multiplier: true,
      },
    });
  }

  const multiplier = resolveMultiplier(demand?.multiplier);
  return Math.floor(baseCost * multiplier);
}

module.exports = {
  JOB_TYPES,
  JOB_RESPEC_BASE_COST,
  JOB_RESPEC_LOOKBACK_DAYS,
  JOB_RESPEC_MULTIPLIER_MIN,
  JOB_RESPEC_MULTIPLIER_MAX,
  getCombatRespecClassKeys,
  getProductionRespecClassKeys,
  localizeCombatClassKey,
  getProductionClassName,
  getProductionClassEmoji,
  normalizeJobType,
  normalizeCombatClass,
  normalizeProductionClass,
  normalizeJobClass,
  canRespec,
  refreshJobRespecDemand,
  getJobRespecCost,
};
