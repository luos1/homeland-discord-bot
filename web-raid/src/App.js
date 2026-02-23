import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Chessboard from './components/Chessboard';
import PartyStatus from './components/PartyStatus';
import SkillPanel from './components/SkillPanel';
import ChatBox from './components/ChatBox';
import CommandQueue from './components/CommandQueue';
import TurnControl from './components/TurnControl';
import './App.css';

const RAID_SERVER_URL = process.env.REACT_APP_RAID_SERVER_URL || 'http://localhost:3001';
const socket = io(RAID_SERVER_URL);

function App() {
  const [gameState, setGameState] = useState({
    boss: { name: '고블린 왕', hp: 5000, maxHp: 5000, maxTurns: 30, position: { x: 1, y: 1 } },
    party: [],
    terrain: [],
    turn: 0,
    maxTurns: 30,
    phase: 1,
    isEnraged: false,
    selectedCharacter: null
  });

  const [commandQueue, setCommandQueue] = useState([]);
  const [actionMode, setActionMode] = useState(null); // 'move', 'attack', 'skill'
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Socket.io 연결
    socket.on('connect', () => {
      console.log('레이드 서버 연결됨');
      // 테스트 레이드 참가
      socket.emit('joinRaid', { raidId: 'test-raid-1' });
    });

    socket.on('gameState', (newState) => {
      setGameState(newState);
    });

    socket.on('chatMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleTileClick = (x, y) => {
    if (!gameState.selectedCharacter) {
      // 캐릭터 선택
      const character = gameState.party.find(
        c => c.position.x === x && c.position.y === y
      );
      if (character) {
        setGameState(prev => ({ ...prev, selectedCharacter: character }));
        setActionMode(null);
        setSelectedSkill(null);
      }
    } else if (actionMode === 'move') {
      // 이동 명령 큐에 추가
      addToQueue({
        characterId: gameState.selectedCharacter.id,
        characterName: gameState.selectedCharacter.name,
        action: 'move',
        target: { x, y }
      });
      setGameState(prev => ({ ...prev, selectedCharacter: null }));
      setActionMode(null);
    } else if (actionMode === 'attack') {
      // 공격 명령 큐에 추가 (보스 타일 클릭 시)
      const isBoss = gameState.boss.position.x === x && gameState.boss.position.y === y;
      if (isBoss) {
        addToQueue({
          characterId: gameState.selectedCharacter.id,
          characterName: gameState.selectedCharacter.name,
          action: 'attack',
          target: 'boss'
        });
        setGameState(prev => ({ ...prev, selectedCharacter: null }));
        setActionMode(null);
      }
    } else if (actionMode === 'skill' && selectedSkill) {
      // 스킬 대상 선택 (아군 또는 보스)
      const targetCharacter = gameState.party.find(
        c => c.position.x === x && c.position.y === y
      );
      const isBoss = gameState.boss.position.x === x && gameState.boss.position.y === y;
      
      if (targetCharacter || isBoss) {
        addToQueue({
          characterId: gameState.selectedCharacter.id,
          characterName: gameState.selectedCharacter.name,
          action: 'skill',
          skillId: selectedSkill.id,
          skillName: selectedSkill.name,
          target: isBoss ? 'boss' : targetCharacter.id
        });
        setGameState(prev => ({ ...prev, selectedCharacter: null }));
        setActionMode(null);
        setSelectedSkill(null);
      }
    }
  };

  const addToQueue = (command) => {
    setCommandQueue(prev => {
      // 같은 캐릭터의 기존 명령 제거
      const filtered = prev.filter(cmd => cmd.characterId !== command.characterId);
      return [...filtered, command];
    });
  };

  const removeFromQueue = (characterId) => {
    setCommandQueue(prev => prev.filter(cmd => cmd.characterId !== characterId));
  };

  const clearQueue = () => {
    setCommandQueue([]);
  };

  const endTurn = () => {
    if (commandQueue.length === 0) {
      alert('명령을 입력하세요!');
      return;
    }

    // 서버로 턴 종료 + 명령 큐 전송
    socket.emit('endTurn', { commands: commandQueue });
    setCommandQueue([]);
    setGameState(prev => ({ ...prev, selectedCharacter: null }));
    setActionMode(null);
  };

  const sendMessage = (text) => {
    socket.emit('chatMessage', {
      userId: 'player1', // TODO: 실제 userId
      text
    });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🏰 Homeland 레이드</h1>
        <div className="boss-info">
          <span>{gameState.boss.name}</span>
          <div className="hp-bar">
            <div 
              className="hp-fill" 
              style={{ width: `${(gameState.boss.hp / gameState.boss.maxHp) * 100}%` }}
            />
          </div>
          <span>{gameState.boss.hp} / {gameState.boss.maxHp}</span>
        </div>
        <div className="turn-info">
          <span>턴 {gameState.turn} / {gameState.maxTurns}</span>
          <span className="phase">페이즈 {gameState.phase}</span>
          {gameState.isEnraged && <span className="enraged">💀 광폭화!</span>}
        </div>
      </header>

      <div className="game-container">
        <div className="left-panel">
          <Chessboard 
            terrain={gameState.terrain}
            boss={gameState.boss}
            party={gameState.party}
            selectedCharacter={gameState.selectedCharacter}
            actionMode={actionMode}
            onTileClick={handleTileClick}
          />
          
          {gameState.selectedCharacter && (
            <SkillPanel 
              character={gameState.selectedCharacter}
              actionMode={actionMode}
              onActionSelect={setActionMode}
              onSkillSelect={setSelectedSkill}
            />
          )}
          
          <CommandQueue 
            commands={commandQueue}
            party={gameState.party}
            onRemove={removeFromQueue}
          />
          
          <TurnControl 
            commandQueue={commandQueue}
            onClear={clearQueue}
            onEndTurn={endTurn}
            remainingTurns={gameState.maxTurns - gameState.turn}
          />
        </div>

        <div className="right-panel">
          <PartyStatus 
            party={gameState.party}
            commandQueue={commandQueue}
            selectedCharacter={gameState.selectedCharacter}
            onSelectCharacter={(char) => setGameState(prev => ({ ...prev, selectedCharacter: char }))}
          />
          
          <ChatBox 
            messages={messages}
            onSendMessage={sendMessage}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
