/**
 * 🎮 Combat Pattern System
 * Phase 1: Monster Pattern & Enhanced Combat Feedback
 */

const { getMonsterBySessionName } = require('./monsters');

/**
 * 몬스터 패턴 업데이트
 */
function advanceMonsterPattern(monsterName, currentPhase = 0) {
  const monster = getMonsterBySessionName(monsterName);
  if (!monster || !monster.patterns || monster.patterns.length === 0) {
    return { nextPhase: 0, pattern: null };
  }

  const nextPhase = (currentPhase + 1) % monster.patterns.length;
  const pattern = monster.patterns[nextPhase];

  return { nextPhase, pattern };
}

/**
 * 현재 패턴 가져오기
 */
function getCurrentPattern(monsterName, currentPhase = 0) {
  const monster = getMonsterBySessionName(monsterName);
  if (!monster || !monster.patterns || monster.patterns.length === 0) {
    return null;
  }

  return monster.patterns[currentPhase] || null;
}

/**
 * 패턴 공격 데미지 계산
 */
function calculatePatternDamage(baseAttack, pattern) {
  if (!pattern) {
    return baseAttack;
  }

  const multiplier = pattern.attackMultiplier ?? 1.0;
  return Math.floor(baseAttack * multiplier);
}

/**
 * 패턴 방어력 보너스 계산
 */
function calculatePatternDefense(baseDefense, pattern) {
  if (!pattern) {
    return baseDefense;
  }

  const defenseBoost = pattern.defenseBoost ?? 1.0;
  return Math.floor(baseDefense * defenseBoost);
}

/**
 * 패턴 힐 계산 (리치 등)
 */
function calculatePatternHeal(damage, pattern) {
  if (!pattern || !pattern.heal) {
    return 0;
  }

  return Math.floor(damage * pattern.heal);
}

/**
 * 패턴 경고 메시지
 */
function getPatternWarning(pattern) {
  if (!pattern || !pattern.warn) {
    return null;
  }

  return pattern.warn;
}

/**
 * 랜덤 전투 이벤트 발생 (20% 확률)
 */
function rollCombatEvent() {
  const roll = Math.random();
  
  if (roll < 0.05) {
    // 5% - 번개 섬광 (몬스터 1턴 기절)
    return {
      type: 'lightning',
      emoji: '⚡',
      title: '번개 섬광!',
      description: '하늘에서 번개가 내려쳐 몬스터를 기절시켰습니다!',
      effect: 'monster_stun',
    };
  }

  if (roll < 0.10) {
    // 5% - 결정적 순간 (다음 공격 크리티컬 확정)
    return {
      type: 'critical_moment',
      emoji: '🌟',
      title: '결정적 순간!',
      description: '완벽한 타이밍! 다음 공격이 크리티컬로 적중합니다!',
      effect: 'guaranteed_crit',
    };
  }

  if (roll < 0.13) {
    // 3% - 위기일발 (몬스터 특수 공격 2배)
    return {
      type: 'crisis',
      emoji: '💀',
      title: '위기일발!',
      description: '몬스터가 광폭화했습니다! 다음 공격이 2배!',
      effect: 'monster_rage',
    };
  }

  if (roll < 0.20) {
    // 7% - 행운의 순간 (아이템 드롭 확률 2배)
    return {
      type: 'lucky',
      emoji: '🍀',
      title: '행운의 순간!',
      description: '행운의 기운이 감돕니다! 아이템 드롭 확률 2배!',
      effect: 'double_drop',
    };
  }

  return null;
}

/**
 * 전투 로그 강화 - 크리티컬
 */
function buildCriticalLog(attackerName, targetName, damage) {
  return [
    '━━━━━━━━━━━━━━━━━━━━━━',
    '💥💥 **크리티컬 히트!** 💥💥',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `${attackerName}의 공격이 ${targetName}의 급소를 찔렀다!`,
    `💔 **${damage}** 치명타 데미지!`,
    '━━━━━━━━━━━━━━━━━━━━━━',
  ];
}

/**
 * 전투 로그 강화 - 회피
 */
function buildDodgeLog(attackerName, targetName) {
  return [
    '━━━━━━━━━━━━━━━━━━━━━━',
    '💨💨 **화려한 회피!** 💨💨',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `${targetName}이(가) ${attackerName}의 공격을 완벽하게 회피했다!`,
    '🔷 마나 10 회복!',
    '💡 반격 준비!',
    '━━━━━━━━━━━━━━━━━━━━━━',
  ];
}

/**
 * 전투 로그 강화 - 반격 찬스
 */
function buildCounterLog(damage) {
  return [
    '━━━━━━━━━━━━━━━━━━━━━━',
    '💥 **반격 찬스 발동!** 💥',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `패턴을 읽고 방어 성공!`,
    `💪 다음 턴 공격력 +20%`,
    `⚔️ 예상 추가 데미지: +${damage}`,
    '━━━━━━━━━━━━━━━━━━━━━━',
  ];
}

/**
 * 랜덤 이벤트 로그
 */
function buildEventLog(event) {
  if (!event) return [];

  return [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `${event.emoji} **${event.title}** ${event.emoji}`,
    '━━━━━━━━━━━━━━━━━━━━━━',
    event.description,
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];
}

module.exports = {
  advanceMonsterPattern,
  getCurrentPattern,
  calculatePatternDamage,
  calculatePatternDefense,
  calculatePatternHeal,
  getPatternWarning,
  rollCombatEvent,
  buildCriticalLog,
  buildDodgeLog,
  buildCounterLog,
  buildEventLog,
};
