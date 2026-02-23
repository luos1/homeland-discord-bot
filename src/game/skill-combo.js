/**
 * 스킬 콤보 시스템
 * 
 * 연속 스킬 사용 시 추가 데미지 및 특수 효과
 */

// 콤보 체인 저장 (sessionId -> 마지막 3개 스킬)
const comboChains = new Map();

// 콤보 패턴 정의
const COMBO_PATTERNS = {
  // 화염 폭발 (불 -> 불 -> 불)
  triple_fire: {
    skills: ['fireball', 'fireball', 'fireball'],
    name: '🔥 화염 폭발',
    damageMultiplier: 3.0,
    effect: '적을 불태웁니다!'
  },
  
  // 빙하 폭풍 (얼음 -> 얼음 -> 얼음)
  triple_ice: {
    skills: ['ice_shard', 'ice_shard', 'ice_shard'],
    name: '❄️ 빙하 폭풍',
    damageMultiplier: 3.0,
    effect: '적을 얼립니다!'
  },
  
  // 번개 연쇄 (번개 -> 번개 -> 번개)
  triple_lightning: {
    skills: ['lightning', 'lightning', 'lightning'],
    name: '⚡ 번개 연쇄',
    damageMultiplier: 3.0,
    effect: '전격 충격!'
  },
  
  // 원소 융합 (불 -> 얼음 -> 번개)
  elemental_fusion: {
    skills: ['fireball', 'ice_shard', 'lightning'],
    name: '🌟 원소 융합',
    damageMultiplier: 4.0,
    effect: '모든 원소의 힘이 합쳐집니다!'
  },
  
  // 역원소 융합 (번개 -> 얼음 -> 불)
  reverse_fusion: {
    skills: ['lightning', 'ice_shard', 'fireball'],
    name: '💫 역원소 융합',
    damageMultiplier: 4.0,
    effect: '원소가 역순으로 폭발합니다!'
  },
  
  // 냉혹한 일격 (얼음 -> 물리공격 -> 번개)
  cold_strike: {
    skills: ['ice_shard', 'power_strike', 'lightning'],
    name: '❄️⚔️ 냉혹한 일격',
    damageMultiplier: 3.5,
    effect: '얼린 적을 강타합니다!'
  },
  
  // 화염 강타 (불 -> 물리공격 -> 불)
  flame_strike: {
    skills: ['fireball', 'power_strike', 'fireball'],
    name: '🔥⚔️ 화염 강타',
    damageMultiplier: 3.5,
    effect: '불타는 검!'
  }
};

/**
 * 스킬 사용 기록
 */
function recordSkillUse(sessionId, skillKey) {
  if (!comboChains.has(sessionId)) {
    comboChains.set(sessionId, []);
  }
  
  const chain = comboChains.get(sessionId);
  chain.push(skillKey);
  
  // 최근 3개만 유지
  if (chain.length > 3) {
    chain.shift();
  }
}

/**
 * 콤보 체크
 */
function checkCombo(sessionId) {
  const chain = comboChains.get(sessionId);
  
  if (!chain || chain.length < 3) {
    return null;
  }
  
  // 최근 3개 스킬
  const recent3 = chain.slice(-3);
  
  // 패턴 매칭
  for (const [comboKey, pattern] of Object.entries(COMBO_PATTERNS)) {
    if (arraysEqual(recent3, pattern.skills)) {
      return {
        key: comboKey,
        ...pattern
      };
    }
  }
  
  return null;
}

/**
 * 콤보 초기화 (전투 종료 시)
 */
function clearCombo(sessionId) {
  comboChains.delete(sessionId);
}

/**
 * 현재 체인 조회
 */
function getChain(sessionId) {
  return comboChains.get(sessionId) || [];
}

/**
 * 콤보 가능 여부 (다음 스킬 힌트)
 */
function getPossibleCombos(sessionId) {
  const chain = comboChains.get(sessionId);
  
  if (!chain || chain.length === 0) {
    // 첫 스킬 - 모든 패턴 가능
    return Object.values(COMBO_PATTERNS).map(p => ({
      name: p.name,
      nextSkill: p.skills[0]
    }));
  }
  
  if (chain.length === 1) {
    // 두 번째 스킬
    const possible = [];
    for (const pattern of Object.values(COMBO_PATTERNS)) {
      if (pattern.skills[0] === chain[0]) {
        possible.push({
          name: pattern.name,
          nextSkill: pattern.skills[1]
        });
      }
    }
    return possible;
  }
  
  if (chain.length === 2) {
    // 세 번째 스킬 (콤보 완성)
    const possible = [];
    for (const pattern of Object.values(COMBO_PATTERNS)) {
      if (pattern.skills[0] === chain[0] && pattern.skills[1] === chain[1]) {
        possible.push({
          name: pattern.name,
          nextSkill: pattern.skills[2],
          willComplete: true
        });
      }
    }
    return possible;
  }
  
  return [];
}

/**
 * 배열 비교
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * 콤보 데미지 계산
 */
function calculateComboDamage(baseDamage, combo) {
  if (!combo) return baseDamage;
  
  return Math.floor(baseDamage * combo.damageMultiplier);
}

/**
 * 콤보 시각 효과 텍스트
 */
function getComboVisual(combo) {
  if (!combo) return '';
  
  return [
    '',
    '━━━━━━━━━━━━━━━━',
    `✨ **${combo.name}** ✨`,
    `💥 ${combo.effect}`,
    `🎯 데미지 **x${combo.damageMultiplier}**배!`,
    '━━━━━━━━━━━━━━━━',
    ''
  ].join('\n');
}

module.exports = {
  recordSkillUse,
  checkCombo,
  clearCombo,
  getChain,
  getPossibleCombos,
  calculateComboDamage,
  getComboVisual,
  COMBO_PATTERNS
};
