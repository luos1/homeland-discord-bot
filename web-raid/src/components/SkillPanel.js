import React from 'react';
import './SkillPanel.css';

function SkillPanel({ character, actionMode, onActionSelect, onSkillSelect }) {
  if (!character) return null;

  return (
    <div className="skill-panel">
      <h3>선택된 캐릭터: {character.name}</h3>
      
      <div className="character-stats">
        <div className="stat">
          <span className="stat-label">HP:</span>
          <span className="stat-value">{character.hp} / {character.maxHp}</span>
        </div>
        <div className="stat">
          <span className="stat-label">MP:</span>
          <span className="stat-value">{character.mp} / {character.maxMp}</span>
        </div>
      </div>

      <div className="action-buttons">
        <h4>행동:</h4>
        <div className="auto-hint">
          💡 타일 클릭 시 자동 판단:
          <br />• 빈 칸 → 이동 | 보스 → 공격
        </div>
        <button 
          className={`action-btn ${actionMode === 'skill' ? 'active' : ''}`}
          onClick={() => onActionSelect('skill')}
        >
          🛡️ 스킬 사용
        </button>
      </div>

      {actionMode === 'skill' && (
        <div className="skills">
          <h4>스킬 선택:</h4>
          {character.skills.map(skill => {
            const canUse = skill.cooldown === 0 && character.mp >= skill.cost;
            const isSelfBuff = ['taunt', 'defend'].includes(skill.id);
            
            return (
              <button
                key={skill.id}
                className={`skill-button ${canUse ? 'ready' : 'disabled'}`}
                onClick={() => canUse && onSkillSelect(skill)}
                disabled={!canUse}
              >
                <span className="skill-icon">{skill.icon}</span>
                <div className="skill-info">
                  <span className="skill-name">
                    {skill.name}
                    {isSelfBuff && ' (자신)'}
                  </span>
                  {skill.cooldown > 0 ? (
                    <span className="skill-cooldown">쿨타임 {skill.cooldown}턴</span>
                  ) : character.mp < skill.cost ? (
                    <span className="skill-cost">MP 부족 (필요: {skill.cost})</span>
                  ) : (
                    <span className="skill-ready">준비됨 (MP {skill.cost})</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="controls-hint">
        {!actionMode && '💡 타일을 클릭하세요 (빈 칸=이동, 보스=공격)'}
        {actionMode === 'skill' && '🎯 스킬을 선택한 후 대상을 클릭하세요'}
      </div>
    </div>
  );
}

export default SkillPanel;
