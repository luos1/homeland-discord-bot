import React from 'react';
import './TurnControl.css';

function TurnControl({ commandQueue, onClear, onEndTurn, remainingTurns }) {
  const getWarningLevel = () => {
    if (remainingTurns <= 5) return 'critical';
    if (remainingTurns <= 10) return 'warning';
    return 'safe';
  };

  const getWarningMessage = () => {
    if (remainingTurns <= 5) return '🚨 광폭화 임박!';
    if (remainingTurns <= 10) return '⚠️ 서두르세요!';
    return '여유있음';
  };

  return (
    <div className="turn-control">
      <div className={`remaining-turns ${getWarningLevel()}`}>
        <span className="label">⏱️ 남은 턴:</span>
        <span className="value">{remainingTurns}</span>
        <span className="message">{getWarningMessage()}</span>
      </div>
      
      <div className="control-buttons">
        <button 
          className="clear-btn"
          onClick={onClear}
          disabled={commandQueue.length === 0}
        >
          🔄 명령 전체 취소
        </button>
        
        <button 
          className="end-turn-btn"
          onClick={onEndTurn}
          disabled={commandQueue.length === 0}
        >
          ✅ 턴 종료 ({commandQueue.length}개 명령)
        </button>
      </div>
      
      <div className="hint">
        💡 8명의 명령을 모두 입력한 후 [턴 종료]를 눌러주세요
      </div>
    </div>
  );
}

export default TurnControl;
