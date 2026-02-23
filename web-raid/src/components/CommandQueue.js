import React from 'react';
import './CommandQueue.css';

function CommandQueue({ commands, party, onRemove }) {
  const getCommandText = (cmd) => {
    switch (cmd.action) {
      case 'move':
        return `(${cmd.target.x}, ${cmd.target.y})로 이동`;
      case 'attack':
        return '보스 공격';
      case 'skill':
        return `${cmd.skillName} 사용`;
      case 'wait':
        return '대기';
      default:
        return cmd.action;
    }
  };

  const getStatusIcon = (characterId) => {
    const hasCommand = commands.some(cmd => cmd.characterId === characterId);
    return hasCommand ? '✅' : '⏸️';
  };

  return (
    <div className="command-queue">
      <h3>현재 턴 명령 큐</h3>
      
      <div className="queue-list">
        {party.map((character) => {
          const command = commands.find(cmd => cmd.characterId === character.id);
          const hasCommand = !!command;
          
          return (
            <div 
              key={character.id} 
              className={`queue-item ${hasCommand ? 'completed' : 'pending'}`}
            >
              <span className="status-icon">{getStatusIcon(character.id)}</span>
              <span className="character-name">{character.name}</span>
              <span className="command-text">
                {hasCommand ? getCommandText(command) : '(명령 대기 중...)'}
              </span>
              {hasCommand && (
                <button 
                  className="remove-btn"
                  onClick={() => onRemove(character.id)}
                  title="명령 취소"
                >
                  ❌
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="queue-summary">
        <span>명령 완료: {commands.length} / {party.length}</span>
      </div>
    </div>
  );
}

export default CommandQueue;
