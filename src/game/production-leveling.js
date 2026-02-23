// 생산 레벨링 시스템
const { PRODUCTION_CLASSES } = require('./production-classes');

// 레벨별 요구 경험치
function getRequiredProductionXP(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function resolveProductionMasteryField(productionClass) {
  const normalizedClass = (productionClass || '').toLowerCase();

  if (!normalizedClass) {
    return null;
  }

  if (normalizedClass === 'blacksmith') {
    return 'blacksmithMastery';
  }

  if (normalizedClass === 'alchemist') {
    return 'alchemistMastery';
  }

  if (normalizedClass === 'gatherer') {
    return 'gathererMastery';
  }

  const classData = PRODUCTION_CLASSES[normalizedClass];
  if (classData?.category === 'gathering') {
    return 'gathererMastery';
  }

  if (classData?.category === 'crafting') {
    return normalizedClass === 'alchemist' ? 'alchemistMastery' : 'blacksmithMastery';
  }

  return null;
}

// 경험치 적용 및 레벨업 처리
function applyProductionExperience(character, xpGain) {
  let currentLevel = character.productionLevel || 1;
  let currentXp = character.productionXp || 0;
  let levelsGained = 0;

  currentXp += xpGain;

  // 레벨업 체크
  while (currentXp >= getRequiredProductionXP(currentLevel)) {
    currentXp -= getRequiredProductionXP(currentLevel);
    currentLevel += 1;
    levelsGained += 1;
  }

  const masteryField = resolveProductionMasteryField(character.productionClass);
  const masteryUpdates = {};

  if (masteryField) {
    masteryUpdates[masteryField] = (character[masteryField] || 0) + 1;
  }

  return {
    productionLevel: currentLevel,
    productionXp: currentXp,
    levelsGained,
    masteryUpdates,
  };
}

// 레벨업 보상 계산
function getProductionLevelUpRewards(level) {
  const rewards = {
    gold: level * 100,
    message: [],
  };

  // 특정 레벨 보상
  if (level % 5 === 0) {
    rewards.message.push(`🎁 레벨 ${level} 달성 보너스: +${level * 50}G 추가!`);
    rewards.gold += level * 50;
  }

  if (level === 10) {
    rewards.message.push('🏆 생산 마스터 10레벨 달성!');
  }

  if (level === 20) {
    rewards.message.push('👑 생산 대가 20레벨 달성!');
  }

  return rewards;
}

module.exports = {
  getRequiredProductionXP,
  resolveProductionMasteryField,
  applyProductionExperience,
  getProductionLevelUpRewards,
};
