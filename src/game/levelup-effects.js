/**
 * 레벨업 연출 강화
 * 
 * 레벨업 시 화려한 시각 효과와 성장 실감
 */

/**
 * 레벨업 메시지 생성 (강화된 연출)
 */
function createLevelUpMessage(levelData) {
  const { oldLevel, newLevel, levelsGained, statGains } = levelData;
  
  const messages = [];
  
  // 레벨업 헤더
  messages.push('');
  messages.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  messages.push('✨✨✨ **LEVEL UP!!** ✨✨✨');
  messages.push('');
  
  // 레벨 표시
  if (levelsGained === 1) {
    messages.push(`📊 Lv.${oldLevel} → **Lv.${newLevel}** 🎉`);
  } else {
    messages.push(`📊 Lv.${oldLevel} → **Lv.${newLevel}** (+${levelsGained}) 🎉🎉`);
  }
  
  messages.push('');
  messages.push('💪 **스탯 증가!**');
  messages.push('');
  
  // 스탯 증가 표시
  if (statGains.hp > 0) {
    messages.push(`❤️ HP +${statGains.hp} → **${statGains.newHp}**`);
  }
  
  if (statGains.mp > 0) {
    messages.push(`🔷 MP +${statGains.mp} → **${statGains.newMp}**`);
  }
  
  if (statGains.attack > 0) {
    messages.push(`⚔️ 공격력 +${statGains.attack} → **${statGains.newAttack}**`);
  }
  
  if (statGains.defense > 0) {
    messages.push(`🛡️ 방어력 +${statGains.defense} → **${statGains.newDefense}**`);
  }
  
  messages.push('');
  messages.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  messages.push('');
  
  // 마일스톤 메시지
  if (newLevel % 10 === 0) {
    messages.push('🌟🌟🌟 **레벨 ' + newLevel + ' 달성!** 🌟🌟🌟');
    messages.push('🎁 특별 보상이 지급되었습니다!');
    messages.push('');
  } else if (newLevel % 5 === 0) {
    messages.push('🔥 **레벨 ' + newLevel + ' 돌파!** 🔥');
    messages.push('');
  }
  
  return messages.join('\n');
}

/**
 * 다중 레벨업 연출 (2레벨 이상 오를 때)
 */
function createMultiLevelUpMessage(levelData) {
  const { oldLevel, newLevel, levelsGained, statGains } = levelData;
  
  const messages = [];
  
  messages.push('');
  messages.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  messages.push('💥💥💥 **MULTI LEVEL UP!!** 💥💥💥');
  messages.push('');
  messages.push(`🚀 **${levelsGained}레벨** 급상승! 🚀`);
  messages.push('');
  messages.push(`📊 Lv.${oldLevel} → **Lv.${newLevel}**`);
  messages.push('');
  messages.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  messages.push('');
  
  messages.push('💪 **총 스탯 증가:**');
  messages.push('');
  messages.push(`❤️ HP +${statGains.hp} (${statGains.oldHp} → **${statGains.newHp}**)`);
  messages.push(`🔷 MP +${statGains.mp} (${statGains.oldMp} → **${statGains.newMp}**)`);
  messages.push(`⚔️ 공격 +${statGains.attack} (${statGains.oldAttack} → **${statGains.newAttack}**)`);
  messages.push(`🛡️ 방어 +${statGains.defense} (${statGains.oldDefense} → **${statGains.newDefense}**)`);
  messages.push('');
  
  messages.push('✨ 캐릭터가 훨씬 강해졌습니다! ✨');
  messages.push('');
  
  return messages.join('\n');
}

/**
 * 스킬 언락 메시지
 */
function createSkillUnlockMessage(skillName, skillLevel) {
  const messages = [];
  
  messages.push('');
  messages.push('━━━━━━━━━━━━━━━━━━━');
  messages.push('🎓 **새로운 스킬 습득!** 🎓');
  messages.push('');
  messages.push(`✨ **${skillName}** 스킬을 배웠습니다!`);
  messages.push(`📈 레벨 ${skillLevel}에서 사용 가능`);
  messages.push('');
  messages.push('━━━━━━━━━━━━━━━━━━━');
  messages.push('');
  
  return messages.join('\n');
}

module.exports = {
  createLevelUpMessage,
  createMultiLevelUpMessage,
  createSkillUnlockMessage
};
