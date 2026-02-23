import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Chessboard from './components/Chessboard';
import PartyStatus from './components/PartyStatus';
import SkillPanel from './components/SkillPanel';
import ChatBox from './components/ChatBox';
import CommandQueue from './components/CommandQueue';
import TurnControl from './components/TurnControl';
import CombatLog from './components/CombatLog';
import BattleEffects from './components/BattleEffects';
import './App.css';

const RAID_SERVER_URL = process.env.REACT_APP_RAID_SERVER_URL || 'http://localhost:3001';

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
  const [socket, setSocket] = useState(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Socket.io 연결
    const newSocket = io(RAID_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ 레이드 서버 연결됨');
      newSocket.emit('joinRaid', { raidId: 'test-raid-1' });
      console.log('📤 joinRaid 전송');
    });

    newSocket.on('gameState', (newState) => {
      console.log('📥 gameState 수신:', newState);
      setGameState(newState);
      
      // 화면 쉐이크 체크
      if (newState.battleEffects && newState.battleEffects.some(e => e.type === 'shake')) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
      
      // 이펙트가 있으면 2초 후 자동 제거 (클라이언트 측)
      if (newState.battleEffects && newState.battleEffects.length > 0) {
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            battleEffects: []
          }));
        }, 2000);
      }
    });

    newSocket.on('chatMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleTileClick = (x, y) => {
    if (!socket) return;

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
      return;
    }

    const character = gameState.party.find(c => c.position.x === x && c.position.y === y);
    const isBoss = gameState.boss.position.x === x && gameState.boss.position.y === y;
    const isEmpty = !character && !isBoss && gameState.terrain[y]?.[x]?.type !== 'obstacle';

    // 스킬 모드일 때
    if (actionMode === 'skill' && selectedSkill) {
      // 자기 버프 스킬 (도발, 방어, 정화)은 자동으로 자신에게 사용
      const selfBuffSkills = ['taunt', 'defend', 'cleanse_poison'];
      if (selfBuffSkills.includes(selectedSkill.id)) {
        socket.emit('useSkill', {
          characterId: gameState.selectedCharacter.id,
          skillId: selectedSkill.id,
          targetId: gameState.selectedCharacter.id
        });
        
        // 명령 기록
        addToQueue({
          characterId: gameState.selectedCharacter.id,
          characterName: gameState.selectedCharacter.name,
          action: 'skill',
          skillId: selectedSkill.id,
          skillName: selectedSkill.name,
          target: 'self'
        });
        
        setGameState(prev => ({ ...prev, selectedCharacter: null }));
        setActionMode(null);
        setSelectedSkill(null);
        return;
      }
      
      // 타겟 스킬 - 기존 로직
      const targetCharacter = gameState.party.find(
        c => c.position.x === x && c.position.y === y
      );
      const isBoss = gameState.boss.position.x === x && gameState.boss.position.y === y;
      
      if (targetCharacter || isBoss) {
        socket.emit('useSkill', {
          characterId: gameState.selectedCharacter.id,
          skillId: selectedSkill.id,
          targetId: isBoss ? 'boss' : targetCharacter.id
        });
        
        // 명령 기록
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
      return;
    }

    // 스킬 모드가 아닐 때: 자동 판단 (이동 or 공격)
    if (!actionMode || actionMode !== 'skill') {
      // 보스 클릭 → 공격
      if (isBoss) {
        socket.emit('attack', {
          characterId: gameState.selectedCharacter.id
        });
        
        addToQueue({
          characterId: gameState.selectedCharacter.id,
          characterName: gameState.selectedCharacter.name,
          action: 'attack',
          target: 'boss'
        });
        
        setGameState(prev => ({ ...prev, selectedCharacter: null }));
        setActionMode(null);
      }
      // 빈 타일 클릭 → 이동
      else if (isEmpty) {
        socket.emit('moveCharacter', {
          characterId: gameState.selectedCharacter.id,
          target: { x, y }
        });
        
        addToQueue({
          characterId: gameState.selectedCharacter.id,
          characterName: gameState.selectedCharacter.name,
          action: 'move',
          target: { x, y }
        });
        
        setGameState(prev => ({ ...prev, selectedCharacter: null }));
        setActionMode(null);
      }
      // 아군 클릭 → 캐릭터 재선택
      else if (character) {
        setGameState(prev => ({ ...prev, selectedCharacter: character }));
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
    if (!socket) return;

    // 서버로 턴 종료 (보스 턴 실행)
    socket.emit('endTurn');
    
    // 명령 큐 초기화
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

      <div className={`game-container ${shake ? 'shake' : ''}`}>
        <div className="left-panel">
          <div style={{ position: 'relative' }}>
            <Chessboard 
              terrain={gameState.terrain}
              boss={gameState.boss}
              party={gameState.party}
              selectedCharacter={gameState.selectedCharacter}
              actionMode={actionMode}
              onTileClick={handleTileClick}
              commandQueue={commandQueue}
              poisonTiles={gameState.poisonTiles || []}
            />
            <BattleEffects effects={gameState.battleEffects || []} />
          </div>
          
          <CombatLog logs={gameState.combatLog || []} />
          
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
