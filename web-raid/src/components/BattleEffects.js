import React, { useState, useEffect } from 'react';
import './BattleEffects.css';

function BattleEffects({ effects }) {
  const [activeEffects, setActiveEffects] = useState([]);

  useEffect(() => {
    if (effects && effects.length > 0) {
      setActiveEffects(effects);
      
      // 3초 후 자동 제거
      const timer = setTimeout(() => {
        setActiveEffects([]);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [effects]);

  return (
    <div className="battle-effects">
      {activeEffects.map((effect, index) => (
        <div key={`${effect.type}-${index}`}>
          {/* 데미지 숫자 */}
          {effect.type === 'damage' && (
            <div 
              className="damage-number"
              style={{
                left: `${effect.x}px`,
                top: `${effect.y}px`
              }}
            >
              -{effect.amount}
            </div>
          )}
          
          {/* 힐 숫자 */}
          {effect.type === 'heal' && (
            <div 
              className="heal-number"
              style={{
                left: `${effect.x}px`,
                top: `${effect.y}px`
              }}
            >
              +{effect.amount}
            </div>
          )}
          
          {/* 공격 화살표 */}
          {effect.type === 'arrow' && (
            <div 
              className="arrow-effect"
              style={{
                left: `${effect.fromX}px`,
                top: `${effect.fromY}px`,
                '--target-x': `${effect.toX - effect.fromX}px`,
                '--target-y': `${effect.toY - effect.fromY}px`
              }}
            >
              🔥
            </div>
          )}
          
          {/* 스킬 이펙트 */}
          {effect.type === 'skill' && (
            <div 
              className="skill-effect"
              style={{
                left: `${effect.x}px`,
                top: `${effect.y}px`
              }}
            >
              {effect.icon || '✨'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default BattleEffects;
