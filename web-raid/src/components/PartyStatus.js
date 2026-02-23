import React from 'react';
import './PartyStatus.css';

function PartyStatus({ party, commandQueue, selectedCharacter, onSelectCharacter }) {
  const getRoleLabel = (role) => {
    const labels = {
      tank: '탱커',
      healer: '힐러',
      dps: '딜러'
    };
    return labels[role] || role;
  };

  const getRoleEmoji = (role) => {
    const emojis = {
      tank: '🛡️',
      healer: '💚',
      dps: '⚔️'
    };
    return emojis[role] || '👤';
  };

  const getSkillStatus = (character) => {
    const readySkills = character.skills.filter(s => s.cooldown === 0);
    return readySkills.length > 0 ? '⚡' : '';
  };

  return (
    <div className="party-status">
      <h3>전체 공대원 상태 (8명)</h3>
      <div className="party-list">
        {party.map((character, index) => {
          const isSelected = selectedCharacter && selectedCharacter.id === character.id;
          const hasCommand = commandQueue && commandQueue.some(cmd => cmd.characterId === character.id);
          const hpPercent = (character.hp / character.maxHp) * 100;
          const mpPercent = (character.mp / character.maxMp) * 100;

          return (
            <div
              key={character.id}
              className={`character-card ${isSelected ? 'selected' : ''} ${hasCommand ? 'has-command' : ''}`}
              onClick={() => onSelectCharacter(character)}
            >
              <div className="character-header">
                <span className="role-emoji">{getRoleEmoji(character.role)}</span>
                <span className="character-name">
                  {getRoleLabel(character.role)}{index + 1}
                </span>
                <span className="command-status">{hasCommand ? '✅' : '⏸️'}</span>
                <span className="skill-ready">{getSkillStatus(character)}</span>
              </div>

              <div className="stat-bar">
                <span className="stat-label">HP</span>
                <div className="bar hp-bar">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${hpPercent}%`,
                      backgroundColor: hpPercent > 60 ? '#4ade80' : hpPercent > 30 ? '#fbbf24' : '#ef4444'
                    }}
                  />
                </div>
                <span className="stat-value">{character.hp}/{character.maxHp}</span>
              </div>

              <div className="stat-bar">
                <span className="stat-label">MP</span>
                <div className="bar mp-bar">
                  <div 
                    className="bar-fill" 
                    style={{ width: `${mpPercent}%`, backgroundColor: '#3b82f6' }}
                  />
                </div>
                <span className="stat-value">{character.mp}/{character.maxMp}</span>
              </div>

              <div className="skill-cooldowns">
                {character.skills.map(skill => (
                  <div key={skill.id} className="skill-cooldown">
                    <span>{skill.name}</span>
                    {skill.cooldown > 0 ? (
                      <span className="cooldown">쿨 {skill.cooldown}초</span>
                    ) : (
                      <span className="ready">준비됨</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PartyStatus;
