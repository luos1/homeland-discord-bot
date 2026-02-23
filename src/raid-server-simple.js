// 간단한 레이드 서버
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 파티 데이터 - 전투 + 생산 직업 전부 포함 (7x7 맵용)
function createParty() {
  return [
    // === 전투 직업 (3종) ===
    
    // Warrior (전사) - 전방 탱커
    { id: 'warrior1', name: '전사', role: 'combat', class: 'Warrior', hp: 2500, maxHp: 2500, mp: 200, maxMp: 200, position: { x: 3, y: 5 }, skills: [
      { id: 'slash', name: '강타', icon: '⚔️', cost: 20 },
      { id: 'taunt', name: '도발', icon: '🗣️', cost: 25 },
      { id: 'defend', name: '방어', icon: '🛡️', cost: 30 }
    ]},
    
    // Ranger (레인저) - 원거리 딜러
    { id: 'ranger1', name: '레인저1', role: 'combat', class: 'Ranger', hp: 1400, maxHp: 1400, mp: 180, maxMp: 180, position: { x: 1, y: 6 }, skills: [
      { id: 'arrow', name: '정확한 사격', icon: '🏹', cost: 25 },
      { id: 'snipe', name: '저격', icon: '🎯', cost: 40 }
    ]},
    { id: 'ranger2', name: '레인저2', role: 'combat', class: 'Ranger', hp: 1400, maxHp: 1400, mp: 180, maxMp: 180, position: { x: 5, y: 6 }, skills: [
      { id: 'arrow', name: '정확한 사격', icon: '🏹', cost: 25 }
    ]},
    
    // Mage (마법사) - 마법 딜러
    { id: 'mage1', name: '마법사1', role: 'combat', class: 'Mage', hp: 1200, maxHp: 1200, mp: 300, maxMp: 300, position: { x: 2, y: 6 }, skills: [
      { id: 'lightning', name: '번개', icon: '⚡', cost: 35 },
      { id: 'ice', name: '얼음', icon: '❄️', cost: 30 }
    ]},
    { id: 'mage2', name: '마법사2', role: 'combat', class: 'Mage', hp: 1200, maxHp: 1200, mp: 300, maxMp: 300, position: { x: 4, y: 6 }, skills: [
      { id: 'fireball', name: '화염구', icon: '🔥', cost: 30 }
    ]},
    
    // === 생산 직업 (3종) - 지원 역할 ===
    
    // Gatherer (채집가) - 독 정화 전문가
    { id: 'gatherer1', name: '채집가', role: 'production', class: 'Gatherer', hp: 1300, maxHp: 1300, mp: 250, maxMp: 250, position: { x: 0, y: 6 }, skills: [
      { id: 'herb_heal', name: '약초 치료', icon: '🌿', cost: 35 },
      { id: 'cleanse_poison', name: '독 정화 (3×3)', icon: '💚', cost: 50 }
    ]},
    
    // Blacksmith (대장장이) - 방어/수리 지원
    { id: 'blacksmith1', name: '대장장이', role: 'production', class: 'Blacksmith', hp: 1800, maxHp: 1800, mp: 200, maxMp: 200, position: { x: 2, y: 5 }, skills: [
      { id: 'repair', name: '응급 수리', icon: '🔧', cost: 30 },
      { id: 'fortify', name: '강화', icon: '⚒️', cost: 40 }
    ]},
    
    // Alchemist (연금술사) - 포션/버프 지원
    { id: 'alchemist1', name: '연금술사', role: 'production', class: 'Alchemist', hp: 1100, maxHp: 1100, mp: 350, maxMp: 350, position: { x: 4, y: 5 }, skills: [
      { id: 'heal_potion', name: '치료 물약', icon: '🧪', cost: 35 },
      { id: 'mana_potion', name: '마나 물약', icon: '💙', cost: 30 }
    ]}
  ];
}

// 레이드 상태
const gameState = {
  boss: {
    name: '고블린 왕',
    hp: 5000,
    maxHp: 5000,
    position: { x: 3, y: 0 },  // 맵 상단 중앙
    mechanic: 'poison_field',  // 보스 메커니즘
    mechanicCooldown: 3  // 3턴마다 독 장판
  },
  party: createParty(),
  turn: 0,
  maxTurns: 30,
  isEnraged: false,
  combatLog: [],  // 전투 로그
  battleEffects: [],  // 전투 이펙트
  poisonTiles: [],  // 독 타일 위치 [{x, y, duration}, ...]
  terrain: [
    [{ type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }],
    [{ type: 'grass' }, { type: 'obstacle' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'obstacle' }, { type: 'grass' }],
    [{ type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }],
    [{ type: 'grass' }, { type: 'grass' }, { type: 'obstacle' }, { type: 'grass' }, { type: 'obstacle' }, { type: 'grass' }, { type: 'grass' }],
    [{ type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }],
    [{ type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }],
    [{ type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }, { type: 'grass' }]
  ]
};

io.on('connection', (socket) => {
  console.log('✅ 클라이언트 연결:', socket.id);

  // 레이드 참가
  socket.on('joinRaid', ({ raidId }) => {
    console.log(`📥 joinRaid: ${raidId}`);
    socket.join(raidId);
    socket.emit('gameState', gameState);
  });

  // 이동
  socket.on('moveCharacter', ({ characterId, target }) => {
    console.log(`🚶 이동: ${characterId} → (${target.x}, ${target.y})`);
    const character = gameState.party.find(c => c.id === characterId);
    if (character) {
      // 이펙트 초기화
      gameState.battleEffects = [];
      
      const oldPos = { ...character.position };
      character.position = target;
      
      // 이동 이펙트 추가
      gameState.battleEffects = [{
        type: 'move',
        characterId,
        from: oldPos,
        to: target,
        timestamp: Date.now()
      }];
      
      io.emit('gameState', gameState);
    }
  });

  // 스킬 사용
  socket.on('useSkill', ({ characterId, skillId, targetId }) => {
    console.log(`💫 스킬: ${characterId} → ${skillId} → ${targetId}`);
    const character = gameState.party.find(c => c.id === characterId);
    const skill = character?.skills.find(s => s.id === skillId);
    
    if (character && skill && character.mp >= skill.cost) {
      // 이펙트 초기화
      gameState.battleEffects = [];
      
      character.mp -= skill.cost;
      
      // 힐 계열 스킬
      if (['heal', 'herb_heal', 'heal_potion', 'repair'].includes(skillId)) {
        const target = gameState.party.find(c => c.id === targetId);
        if (target) {
          const healAmount = Math.min(300, target.maxHp - target.hp);
          target.hp = Math.min(target.maxHp, target.hp + 300);
          
          if (!gameState.combatLog) gameState.combatLog = [];
          gameState.combatLog.push({
            type: 'heal',
            text: `${skill.icon} ${character.name}의 ${skill.name}! ${target.name} +${healAmount} HP`,
            color: 'green'
          });
          
          // 힐 이펙트
          gameState.battleEffects = [
            {
              type: 'skill',
              x: target.position.x * 60 + 30,
              y: target.position.y * 60 + 30,
              icon: skill.icon
            },
            {
              type: 'heal',
              x: target.position.x * 60 + 30,
              y: target.position.y * 60 + 30,
              amount: healAmount
            }
          ];
        }
      }
      // 마나 회복 스킬
      else if (skillId === 'mana_potion') {
        const target = gameState.party.find(c => c.id === targetId);
        if (target) {
          const manaAmount = Math.min(100, target.maxMp - target.mp);
          target.mp = Math.min(target.maxMp, target.mp + 100);
          
          if (!gameState.combatLog) gameState.combatLog = [];
          gameState.combatLog.push({
            type: 'heal',
            text: `${skill.icon} ${character.name}의 ${skill.name}! ${target.name} +${manaAmount} MP`,
            color: 'cyan'
          });
          
          gameState.battleEffects = [
            {
              type: 'skill',
              x: target.position.x * 60 + 30,
              y: target.position.y * 60 + 30,
              icon: '💙'
            }
          ];
        }
      }
      // Gatherer 정화 스킬 - 자기 주변 3×3 독 타일 제거
      else if (skillId === 'cleanse_poison') {
        const centerX = character.position.x;
        const centerY = character.position.y;
        
        const beforeCount = gameState.poisonTiles.length;
        
        // 3×3 범위 독 타일 제거
        gameState.poisonTiles = gameState.poisonTiles.filter(p => {
          const dx = Math.abs(p.x - centerX);
          const dy = Math.abs(p.y - centerY);
          return dx > 1 || dy > 1; // 주변 3×3 밖이면 유지
        });
        
        const cleansedCount = beforeCount - gameState.poisonTiles.length;
        
        if (!gameState.combatLog) gameState.combatLog = [];
        gameState.combatLog.push({
          type: 'cleanse',
          text: `🌿 ${character.name}의 약초 정화! 독 타일 ${cleansedCount}개 제거!`,
          color: 'green'
        });
        
        gameState.battleEffects = [
          {
            type: 'skill',
            x: centerX * 60 + 30,
            y: centerY * 60 + 30,
            icon: '🌿'
          }
        ];
      }
      // 탱커 스킬 (도발, 방어) - 자신에게 사용
      else if (['taunt', 'defend'].includes(skillId)) {
        // 자신에게 사용
        const healAmount = Math.min(100, character.maxHp - character.hp);
        character.hp = Math.min(character.maxHp, character.hp + 100);
        
        if (!gameState.combatLog) gameState.combatLog = [];
        gameState.combatLog.push({
          type: 'buff',
          text: `${skill.icon} ${character.name}의 ${skill.name}! 방어 태세 강화!`,
          color: 'yellow'
        });
        
        gameState.battleEffects = [
          {
            type: 'skill',
            x: character.position.x * 60 + 30,
            y: character.position.y * 60 + 30,
            icon: skill.icon
          }
        ];
      }
      // 버프 계열 스킬 (임시: 약간의 HP 회복)
      else if (['buff', 'fortify'].includes(skillId)) {
        const target = gameState.party.find(c => c.id === targetId);
        if (target) {
          const healAmount = Math.min(150, target.maxHp - target.hp);
          target.hp = Math.min(target.maxHp, target.hp + 150);
          
          if (!gameState.combatLog) gameState.combatLog = [];
          gameState.combatLog.push({
            type: 'buff',
            text: `${skill.icon} ${character.name}의 ${skill.name}! ${target.name} 강화!`,
            color: 'yellow'
          });
          
          gameState.battleEffects = [
            {
              type: 'skill',
              x: target.position.x * 60 + 30,
              y: target.position.y * 60 + 30,
              icon: skill.icon
            }
          ];
        }
      }
      // 공격 스킬
      else if (targetId === 'boss') {
        const damage = 300;
        const actualDamage = Math.min(damage, gameState.boss.hp);
        gameState.boss.hp = Math.max(0, gameState.boss.hp - damage);
        
        if (!gameState.combatLog) gameState.combatLog = [];
        gameState.combatLog.push({
          type: 'skill_damage',
          text: `${skill.icon} ${character.name}의 ${skill.name}! 보스에게 ${actualDamage} 데미지!`,
          color: 'cyan'
        });
        
        // 스킬 이펙트
        gameState.battleEffects = [
          {
            type: 'skill',
            x: gameState.boss.position.x * 60 + 30,
            y: gameState.boss.position.y * 60 + 30,
            icon: skill.icon
          },
          {
            type: 'damage',
            x: gameState.boss.position.x * 60 + 30,
            y: gameState.boss.position.y * 60 + 30,
            amount: actualDamage
          }
        ];
      }
      
      io.emit('gameState', gameState);
    }
  });

  // 공격
  socket.on('attack', ({ characterId }) => {
    console.log(`⚔️ 공격: ${characterId} → 보스`);
    const character = gameState.party.find(c => c.id === characterId);
    if (character) {
      // 이펙트 초기화
      gameState.battleEffects = [];
      
      const damage = character.role === 'tank' ? 100 : 200;
      const actualDamage = Math.min(damage, gameState.boss.hp);
      gameState.boss.hp = Math.max(0, gameState.boss.hp - damage);
      
      if (!gameState.combatLog) gameState.combatLog = [];
      gameState.combatLog.push({
        type: 'attack',
        text: `⚔️ ${character.name}의 공격! 보스에게 ${actualDamage} 데미지!`,
        color: 'yellow'
      });
      
      // 공격 이펙트 추가
      gameState.battleEffects = [
        {
          type: 'arrow',
          fromX: character.position.x * 60 + 30,
          fromY: character.position.y * 60 + 30,
          toX: gameState.boss.position.x * 60 + 30,
          toY: gameState.boss.position.y * 60 + 30
        },
        {
          type: 'damage',
          x: gameState.boss.position.x * 60 + 30,
          y: gameState.boss.position.y * 60 + 30,
          amount: actualDamage
        }
      ];
      
      io.emit('gameState', gameState);
    }
  });

  // 턴 종료
  socket.on('endTurn', () => {
    console.log('🔄 턴 종료');
    
    // 이펙트 초기화
    gameState.battleEffects = [];
    
    gameState.turn++;
    gameState.combatLog = [];  // 로그 초기화
    
    // 보스 공격
    const tank = gameState.party.find(c => c.role === 'tank');
    if (tank) {
      const damage = gameState.turn >= gameState.maxTurns ? 400 : 200;
      const actualDamage = Math.min(damage, tank.hp);
      tank.hp = Math.max(0, tank.hp - damage);
      
      if (gameState.turn >= gameState.maxTurns && !gameState.isEnraged) {
        gameState.isEnraged = true;
        gameState.combatLog.push({
          type: 'enrage',
          text: '💀 고블린 왕이 광폭화했습니다! (공격력 2배)',
          color: 'red'
        });
      }
      
      gameState.combatLog.push({
        type: 'boss_attack',
        text: `👹 고블린 왕이 ${tank.name}을(를) 공격! ${actualDamage} 데미지!`,
        color: gameState.isEnraged ? 'red' : 'orange',
        target: tank.name,
        damage: actualDamage
      });
      
      // 보스 공격 이펙트
      gameState.battleEffects = [
        {
          type: 'arrow',
          fromX: gameState.boss.position.x * 60 + 30,
          fromY: gameState.boss.position.y * 60 + 30,
          toX: tank.position.x * 60 + 30,
          toY: tank.position.y * 60 + 30
        },
        {
          type: 'damage',
          x: tank.position.x * 60 + 30,
          y: tank.position.y * 60 + 30,
          amount: actualDamage
        },
        {
          type: 'shake',  // 화면 쉐이크
          intensity: gameState.isEnraged ? 'high' : 'medium'
        }
      ];
      
      if (tank.hp === 0) {
        gameState.combatLog.push({
          type: 'death',
          text: `💀 ${tank.name}이(가) 쓰러졌습니다!`,
          color: 'red'
        });
      }
    }
    
    // === 보스 메커니즘: 독 장판 (고블린 왕) ===
    
    // 1. 독 타일 데미지 적용
    if (gameState.poisonTiles && gameState.poisonTiles.length > 0) {
      gameState.party.forEach(character => {
        const onPoison = gameState.poisonTiles.some(
          p => p.x === character.position.x && p.y === character.position.y
        );
        
        if (onPoison) {
          const poisonDamage = 50;  // Normal 난이도
          const actualDamage = Math.min(poisonDamage, character.hp);
          character.hp = Math.max(0, character.hp - poisonDamage);
          
          gameState.combatLog.push({
            type: 'poison',
            text: `☠️ ${character.name}이(가) 독 데미지! -${actualDamage} HP`,
            color: 'red'
          });
          
          if (character.hp === 0) {
            gameState.combatLog.push({
              type: 'death',
              text: `💀 ${character.name}이(가) 독으로 쓰러졌습니다!`,
              color: 'red'
            });
          }
        }
      });
    }
    
    // 2. 독 타일 duration 감소 및 제거
    if (gameState.poisonTiles) {
      gameState.poisonTiles = gameState.poisonTiles.map(p => ({
        ...p,
        duration: p.duration - 1
      })).filter(p => p.duration > 0);
    }
    
    // 3. 3턴마다 새로운 독 장판 생성
    if (gameState.turn % 3 === 0 && gameState.turn > 0) {
      const centerX = Math.floor(Math.random() * 5) + 1;  // 1~5
      const centerY = Math.floor(Math.random() * 5) + 1;  // 1~5
      
      const newPoison = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;
          
          // 맵 범위 체크 (7×7)
          if (x >= 0 && x < 7 && y >= 0 && y < 7) {
            // 장애물이 아니면 독 타일 추가
            if (gameState.terrain[y][x].type !== 'obstacle') {
              newPoison.push({ x, y, duration: 5 });
            }
          }
        }
      }
      
      gameState.poisonTiles.push(...newPoison);
      
      gameState.combatLog.push({
        type: 'mechanic',
        text: `☠️ 고블린 왕이 독 장판 생성! (${centerX}, ${centerY}) 중심 3×3`,
        color: 'red'
      });
    }
    
    // 승패 체크
    if (gameState.boss.hp <= 0) {
      gameState.combatLog.push({
        type: 'victory',
        text: '🎉 레이드 클리어! 고블린 왕을 처치했습니다!',
        color: 'gold'
      });
    } else if (gameState.party.every(c => c.hp <= 0)) {
      gameState.combatLog.push({
        type: 'defeat',
        text: '💀 전멸... 레이드 실패!',
        color: 'red'
      });
    }
    
    io.emit('gameState', gameState);
  });

  // 채팅
  socket.on('chatMessage', ({ text }) => {
    io.emit('chatMessage', {
      type: 'user',
      text,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ 클라이언트 연결 해제:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🎮 레이드 서버 실행 중: http://localhost:${PORT}\n`);
});
