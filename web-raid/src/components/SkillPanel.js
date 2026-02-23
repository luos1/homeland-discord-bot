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
        <h4>행동 선택:</h4>
        <button 
          className={`action-btn ${actionMode === 'move' ? 'active' : ''}`}
          onClick={() => onActionSelect('move')}
        >
          🚶 이동
        </button>
        <button 
          className={`action-btn ${actionMode === 'attack' ? 'active' : ''}`}
          onClick={() => onActionSelect('attack')}
        >
          ⚔️ 공격
        </button>
        <button 
          className={`action-btn ${actionMode === 'skill' ? 'active' : ''}`}
          onClick={() => onActionSelect('skill')}
        >
          🛡️ 스킬
        </button>
      </div>

      {actionMode === 'skill' && (
        <div className="skills">
          <h4>스킬 선택:</h4>
          {character.skills.map(skill => {
            const canUse = skill.cooldown === 0 && character.mp >= skill.cost;
            
            return (
              <button
                key={skill.id}
                className={`skill-button ${canUse ? 'ready' : 'disabled'}`}
                onClick={() => canUse && onSkillSelect(skill)}
                disabled={!canUse}
              >
                <span className="skill-icon">{skill.icon}</span>
                <div className="skill-info">
                  <span className="skill-name">{skill.name}</span>
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
        {!actionMode && '💡 행동을 선택한 후 채스판의 타일을 클릭하세요'}
        {actionMode === 'move' && '📍 이동할 타일을 클릭하세요'}
        {actionMode === 'attack' && '⚔️ 보스를 클릭하세요'}
        {actionMode === 'skill' && '🎯 스킬을 선택한 후 대상을 클릭하세요'}
      </div>
    </div>
  );
}

export default SkillPanel;
