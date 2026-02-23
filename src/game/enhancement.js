/**
 * 장비 강화 시스템
 * 
 * - 장비 레벨 업그레이드
 * - 실패 시 레벨 하락 위험
 * - 강화 성공 시 스탯 증가
 */

// 강화 성공률 (레벨별)
const ENHANCEMENT_SUCCESS_RATES = {
  0: 1.0,    // +0 → +1: 100%
  1: 0.95,   // +1 → +2: 95%
  2: 0.90,   // +2 → +3: 90%
  3: 0.80,   // +3 → +4: 80%
  4: 0.70,   // +4 → +5: 70%
  5: 0.60,   // +5 → +6: 60%
  6: 0.50,   // +6 → +7: 50%
  7: 0.40,   // +7 → +8: 40%
  8: 0.30,   // +8 → +9: 30%
  9: 0.20,   // +9 → +10: 20%
  10: 0.10,  // +10 → +11: 10%
};

// 강화 비용 (레벨별)
const ENHANCEMENT_COSTS = {
  0: 100,
  1: 200,
  2: 400,
  3: 800,
  4: 1600,
  5: 3200,
  6: 6400,
  7: 12800,
  8: 25600,
  9: 51200,
  10: 102400,
};

// 스탯 증가량 (레벨당 +10%)
const STAT_INCREASE_PER_LEVEL = 0.1;

/**
 * 장비 강화 시도
 */
function enhanceEquipment(equipment, character) {
  const currentLevel = equipment.enhancementLevel || 0;
  
  // 최대 레벨 체크
  if (currentLevel >= 15) {
    return {
      success: false,
      error: '더 이상 강화할 수 없습니다. (최대 +15)'
    };
  }
  
  // 비용 체크
  const cost = ENHANCEMENT_COSTS[currentLevel] || (ENHANCEMENT_COSTS[10] * Math.pow(2, currentLevel - 10));
  if (character.gold < cost) {
    return {
      success: false,
      error: `골드가 부족합니다. (필요: ${cost.toLocaleString()}G)`
    };
  }
  
  // 성공률 계산
  const successRate = ENHANCEMENT_SUCCESS_RATES[currentLevel] || 0.05;
  const random = Math.random();
  const isSuccess = random < successRate;
  
  let newLevel = currentLevel;
  let newStats = { ...equipment };
  let message = '';
  
  if (isSuccess) {
    // 성공
    newLevel = currentLevel + 1;
    
    // 스탯 증가
    const baseAttack = equipment.attack || 0;
    const baseDefense = equipment.defense || 0;
    const baseHp = equipment.hp || 0;
    const baseMana = equipment.mana || 0;
    
    newStats = {
      ...equipment,
      enhancementLevel: newLevel,
      attack: Math.floor(baseAttack * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
      defense: Math.floor(baseDefense * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
      hp: Math.floor(baseHp * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
      mana: Math.floor(baseMana * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
    };
    
    message = [
      '',
      '━━━━━━━━━━━━━━━━━━━',
      '✨✨✨ **강화 성공!!** ✨✨✨',
      '',
      `${equipment.name} +${currentLevel} → **+${newLevel}**`,
      '',
      '💪 **스탯 증가:**',
      newStats.attack > equipment.attack ? `⚔️ 공격력: ${equipment.attack} → **${newStats.attack}**` : '',
      newStats.defense > equipment.defense ? `🛡️ 방어력: ${equipment.defense} → **${newStats.defense}**` : '',
      newStats.hp > equipment.hp ? `❤️ HP: ${equipment.hp} → **${newStats.hp}**` : '',
      newStats.mana > equipment.mana ? `🔷 MP: ${equipment.mana} → **${newStats.mana}**` : '',
      '',
      '━━━━━━━━━━━━━━━━━━━',
      ''
    ].filter(Boolean).join('\n');
    
  } else {
    // 실패
    if (currentLevel >= 5) {
      // +5 이상은 실패 시 레벨 하락
      newLevel = Math.max(0, currentLevel - 1);
      
      message = [
        '',
        '━━━━━━━━━━━━━━━━━━━',
        '💥💥 **강화 실패...** 💥💥',
        '',
        `${equipment.name} +${currentLevel} → **+${newLevel}**`,
        '',
        '⚠️ 강화 레벨이 하락했습니다...',
        '',
        '━━━━━━━━━━━━━━━━━━━',
        ''
      ].join('\n');
      
      // 스탯 재계산 (하락)
      const baseAttack = equipment.attack || 0;
      const baseDefense = equipment.defense || 0;
      const baseHp = equipment.hp || 0;
      const baseMana = equipment.mana || 0;
      
      newStats = {
        ...equipment,
        enhancementLevel: newLevel,
        attack: Math.floor(baseAttack * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
        defense: Math.floor(baseDefense * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
        hp: Math.floor(baseHp * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
        mana: Math.floor(baseMana * (1 + STAT_INCREASE_PER_LEVEL * newLevel)),
      };
    } else {
      // +4 이하는 레벨 유지
      message = [
        '',
        '━━━━━━━━━━━━━━━━━━━',
        '❌ **강화 실패** ❌',
        '',
        `${equipment.name} +${currentLevel} (유지)`,
        '',
        '💡 강화 레벨은 유지되었습니다.',
        '',
        '━━━━━━━━━━━━━━━━━━━',
        ''
      ].join('\n');
      
      newStats = equipment;
    }
  }
  
  return {
    success: true,
    isEnhancementSuccess: isSuccess,
    cost,
    oldLevel: currentLevel,
    newLevel,
    newStats,
    message,
    successRate: Math.floor(successRate * 100)
  };
}

/**
 * 강화 정보 조회
 */
function getEnhancementInfo(equipment) {
  const currentLevel = equipment.enhancementLevel || 0;
  const cost = ENHANCEMENT_COSTS[currentLevel] || (ENHANCEMENT_COSTS[10] * Math.pow(2, currentLevel - 10));
  const successRate = ENHANCEMENT_SUCCESS_RATES[currentLevel] || 0.05;
  
  return {
    currentLevel,
    nextLevel: currentLevel + 1,
    cost,
    successRate: Math.floor(successRate * 100),
    failPenalty: currentLevel >= 5 ? '레벨 -1' : '레벨 유지'
  };
}

module.exports = {
  enhanceEquipment,
  getEnhancementInfo,
  ENHANCEMENT_SUCCESS_RATES,
  ENHANCEMENT_COSTS
};
