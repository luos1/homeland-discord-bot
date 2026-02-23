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

function Chessboard({ terrain, boss, party, selectedCharacter, actionMode, onTileClick }) {
  const renderTile = (tile, x, y) => {
    const isSelected = selectedCharacter && 
      selectedCharacter.position.x === x && 
      selectedCharacter.position.y === y;

    const character = party.find(c => c.position.x === x && c.position.y === y);
    const isBoss = boss.position.x === x && boss.position.y === y;
    
    // 액션 모드에 따른 하이라이트
    const isMovable = actionMode === 'move' && !character && !isBoss && tile.type !== 'obstacle';
    const isAttackable = actionMode === 'attack' && isBoss;
    const isTargetable = actionMode === 'skill' && (character || isBoss);

    return (
      <div
        key={`${x}-${y}`}
        className={`tile ${tile.type} ${isSelected ? 'selected' : ''} ${isMovable ? 'movable' : ''} ${isAttackable ? 'attackable' : ''} ${isTargetable ? 'targetable' : ''}`}
        onClick={() => onTileClick(x, y)}
        style={{
          gridColumn: x + 1,
          gridRow: y + 1
        }}
      >
        <div className="tile-bg">{TILE_EMOJIS[tile.type] || '🟩'}</div>
        {isBoss && <div className="entity boss">👑</div>}
        {character && (
          <div className={`entity character ${character.role}`}>
            {getRoleEmoji(character.role)}
          </div>
        )}
        {isSelected && <div className="selection-indicator">📍</div>}
      </div>
    );
  };

  const getRoleEmoji = (role) => {
    const emojis = {
      tank: '🛡️',
      healer: '💚',
      dps: '⚔️'
    };
    return emojis[role] || '👤';
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
        gridTemplateColumns: `repeat(${width}, 80px)`,
        gridTemplateRows: `repeat(${height}, 80px)`
      }}
    >
      {terrain.map((row, y) =>
        row.map((tile, x) => renderTile(tile, x, y))
      )}
    </div>
  );
}

export default Chessboard;
