import React, { useEffect, useRef } from 'react';
import './CombatLog.css';

function CombatLog({ logs }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!logs || logs.length === 0) {
    return (
      <div className="combat-log">
        <div className="log-header">⚔️ 전투 로그</div>
        <div className="log-content empty">
          <p>턴을 종료하면 전투 로그가 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="combat-log">
      <div className="log-header">⚔️ 전투 로그 (턴 {logs.length > 0 ? '종료됨' : ''})</div>
      <div className="log-content">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry ${log.type} ${log.color}`}>
            <span className="log-text">{log.text}</span>
            {log.damage && <span className="log-damage">-{log.damage}</span>}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default CombatLog;
