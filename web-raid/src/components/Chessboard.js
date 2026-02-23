import React from 'react';
import './Chessboard.css';

const TILE_EMOJIS = {
  grass: '🟩',
  water: '🟦',
  lava: '🟥',
  highland: '🟨',
  obstacle: '⬛',
  buff: '✨',
  trap: '🌪️'
};

function Chessboard({ terrain, boss, party, selectedCharacter, actionMode, onTileClick, commandQueue = [], poisonTiles = [] }) {
  const renderTile = (tile, x, y) => {
    const isSelected = selectedCharacter && 
      selectedCharacter.position.x === x && 
      selectedCharacter.position.y === y;

    const character = party.find(c => c.position.x === x && c.position.y === y);
    const isBoss = boss.position.x === x && boss.position.y === y;
    const isPoison = poisonTiles.some(p => p.x === x && p.y === y);
    
    // 명령 내린 캐릭터 체크
    const hasCommand = character && commandQueue.some(cmd => cmd.characterId === character.id);
    
    // 액션 모드에 따른 하이라이트
    const isMovable = actionMode === 'move' && !character && !isBoss && tile.type !== 'obstacle';
    const isAttackable = actionMode === 'attack' && isBoss;
    const isTargetable = actionMode === 'skill' && (character || isBoss);

    return (
      <div
        key={`${x}-${y}`}
        className={`tile ${tile.type} ${isPoison ? 'poison' : ''} ${isSelected ? 'selected' : ''} ${isMovable ? 'movable' : ''} ${isAttackable ? 'attackable' : ''} ${isTargetable ? 'targetable' : ''}`}
        onClick={() => onTileClick(x, y)}
        style={{
          gridColumn: x + 1,
          gridRow: y + 1
        }}
      >
        <div className="tile-bg">{isPoison ? '☠️' : (TILE_EMOJIS[tile.type] || '🟩')}</div>
        {isBoss && <div className="entity boss">👑</div>}
        {character && (
          <div className={`entity character ${character.role} ${hasCommand ? 'has-command' : ''}`}>
            {getClassEmoji(character)}
          </div>
        )}
        {hasCommand && <div className="command-indicator">✅</div>}
        {isSelected && <div className="selection-indicator">📍</div>}
      </div>
    );
  };

  const getClassEmoji = (character) => {
    // Homeland 직업 아이콘 (전투 + 생산)
    const classEmojis = {
      // 전투 직업
      'Warrior': '⚔️',      // 전사
      'Ranger': '🏹',       // 레인저
      'Mage': '🔮',         // 마법사
      
      // 생산 직업
      'Gatherer': '🌾',     // 채집가
      'Blacksmith': '⚒️',   // 대장장이
      'Alchemist': '🧪'     // 연금술사
    };
    
    return classEmojis[character.class] || '👤';
  };

  if (!terrain || terrain.length === 0) {
    return <div className="chessboard loading">로딩 중...</div>;
  }

  const width = terrain[0].length;
  const height = terrain.length;

  return (
    <div 
      className="chessboard"
      style={{
        gridTemplateColumns: `repeat(${width}, 60px)`,
        gridTemplateRows: `repeat(${height}, 60px)`
      }}
    >
      {terrain.map((row, y) =>
        row.map((tile, x) => renderTile(tile, x, y))
      )}
    </div>
  );
}

export default Chessboard;
