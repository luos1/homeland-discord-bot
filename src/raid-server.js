// 레이드 서버 - Express + Socket.io
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://homeland-raid.vercel.app',
      /\.vercel\.app$/  // 모든 Vercel 프리뷰 도메인
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// 레이드 상태 저장
const raids = new Map();

// 고블린 왕 보스 데이터 (프로토타입)
const GOBLIN_KING_DATA = {
  name: '고블린 왕',
  hp: 5000,
  maxHp: 5000,
  maxTurns: 30,
  position: { x: 1, y: 1 },
  pattern: {
    cycle: 3,
    actions: [
      { turnMod: 0, skill: '기본 공격', target: 'tank', damage: 200 },
      { turnMod: 1, skill: '기본 공격', target: 'tank', damage: 200 },
      { turnMod: 2, skill: '강타', target: 'front', damage: 300 }
    ]
  },
  enrage: {
    attackMultiplier: 2.0,
    message: '💀 고블린 왕이 광폭화했습니다!'
  }
};

// 3x3 채스판 지형 (고블린 왕)
const GOBLIN_KING_TERRAIN = [
  [{ type: 'grass' }, { type: 'obstacle' }, { type: 'grass' }],
  [{ type: 'grass' }, { type: 'grass' }, { type: 'grass' }],
  [{ type: 'grass' }, { type: 'obstacle' }, { type: 'grass' }]
];

// 더미 공대원 데이터 (8명)
function createDummyParty() {
  return [
    {
      id: 'tank1',
      name: '탱커1',
      role: 'tank',
      hp: 2000,
      maxHp: 2000,
      mp: 200,
      maxMp: 200,
      position: { x: 0, y: 2 },
      skills: [
        { id: 'defend', name: '방어', icon: '🛡️', cooldown: 0, cost: 30 },
        { id: 'taunt', name: '도발', icon: '⚔️', cooldown: 0, cost: 20 }
      ]
    },
    {
      id: 'healer1',
      name: '힐러1',
      role: 'healer',
      hp: 1000,
      maxHp: 1000,
      mp: 300,
      maxMp: 300,
      position: { x: 0, y: 0 },
      skills: [
        { id: 'heal', name: '회복', icon: '💚', cooldown: 0, cost: 40 },
        { id: 'cleanse', name: '정화', icon: '✨', cooldown: 0, cost: 30 }
      ]
    },
    {
      id: 'healer2',
      name: '힐러2',
      role: 'healer',
      hp: 1000,
      maxHp: 1000,
      mp: 300,
      maxMp: 300,
      position: { x: 2, y: 0 },
      skills: [
        { id: 'heal', name: '회복', icon: '💚', cooldown: 0, cost: 40 },
        { id: 'cleanse', name: '정화', icon: '✨', cooldown: 0, cost: 30 }
      ]
    },
    {
      id: 'dps1',
      name: '딜러1',
      role: 'dps',
      hp: 1200,
      maxHp: 1200,
      mp: 150,
      maxMp: 150,
      position: { x: 0, y: 1 },
      skills: [
        { id: 'arrow', name: '화살', icon: '🔥', cooldown: 0, cost: 25 },
        { id: 'snipe', name: '급소', icon: '💨', cooldown: 0, cost: 50 }
      ]
    },
    {
      id: 'dps2',
      name: '딜러2',
      role: 'dps',
      hp: 1200,
      maxHp: 1200,
      mp: 150,
      maxMp: 150,
      position: { x: 2, y: 1 },
      skills: [
        { id: 'lightning', name: '번개', icon: '⚡', cooldown: 0, cost: 35 },
        { id: 'ice', name: '얼음', icon: '🌊', cooldown: 0, cost: 30 }
      ]
    },
    {
      id: 'dps3',
      name: '딜러3',
      role: 'dps',
      hp: 1200,
      maxHp: 1200,
      mp: 150,
      maxMp: 150,
      position: { x: 1, y: 2 },
      skills: [
        { id: 'slash', name: '베기', icon: '🗡️', cooldown: 0, cost: 20 },
        { id: 'explosion', name: '폭발', icon: '💥', cooldown: 0, cost: 60 }
      ]
    },
    {
      id: 'dps4',
      name: '딜러4',
      role: 'dps',
      hp: 1200,
      maxHp: 1200,
      mp: 150,
      maxMp: 150,
      position: { x: 2, y: 2 },
      skills: [
        { id: 'slash', name: '베기', icon: '🗡️', cooldown: 0, cost: 20 },
        { id: 'explosion', name: '폭발', icon: '💥', cooldown: 0, cost: 60 }
      ]
    },
    {
      id: 'dps5',
      name: '딜러5',
      role: 'dps',
      hp: 1200,
      maxHp: 1200,
      mp: 150,
      maxMp: 150,
      position: { x: 1, y: 0 },
      skills: [
        { id: 'arrow', name: '화살', icon: '🔥', cooldown: 0, cost: 25 },
        { id: 'snipe', name: '급소', icon: '💨', cooldown: 0, cost: 50 }
      ]
    }
  ];
}

// 레이드 생성
function createRaid(raidId) {
  const raid = {
    id: raidId,
    boss: { ...GOBLIN_KING_DATA },
    party: createDummyParty(),
    terrain: GOBLIN_KING_TERRAIN,
    turn: 0,
    maxTurns: GOBLIN_KING_DATA.maxTurns,
    phase: 1,
    isEnraged: false,
    status: 'waiting', // waiting, in-progress, completed, failed
    messages: []
  };
  
  raids.set(raidId, raid);
  return raid;
}

// Socket.io 연결
io.on('connection', (socket) => {
  console.log('클라이언트 연결:', socket.id);

  socket.on('joinRaid', ({ raidId }) => {
    socket.join(raidId);
    
    let raid = raids.get(raidId);
    if (!raid) {
      raid = createRaid(raidId);
    }
    
    socket.emit('gameState', raid);
    console.log(`레이드 참가: ${raidId}`);
  });

  socket.on('moveCharacter', ({ characterId, target }) => {
    const raidId = [...socket.rooms][1]; // 첫 번째는 socket.id
    const raid = raids.get(raidId);
    
    if (!raid) return;

    const character = raid.party.find(c => c.id === characterId);
    if (character) {
      character.position = target;
      
      io.to(raidId).emit('gameState', raid);
      io.to(raidId).emit('chatMessage', {
        type: 'system',
        text: `${character.name}이(가) (${target.x}, ${target.y})로 이동했습니다.`,
        timestamp: Date.now()
      });
    }
  });

  socket.on('useSkill', ({ characterId, skillId }) => {
    const raidId = [...socket.rooms][1];
    const raid = raids.get(raidId);
    
    if (!raid) return;

    const character = raid.party.find(c => c.id === characterId);
    if (!character) return;

    const skill = character.skills.find(s => s.id === skillId);
    if (!skill || skill.cooldown > 0 || character.mp < skill.cost) return;

    // 스킬 사용 (간단한 로직)
    character.mp -= skill.cost;
    
    io.to(raidId).emit('gameState', raid);
    io.to(raidId).emit('chatMessage', {
      type: 'system',
      text: `${character.name}이(가) ${skill.name}을(를) 사용했습니다!`,
      timestamp: Date.now()
    });
  });

  socket.on('endTurn', ({ commands }) => {
    const raidId = [...socket.rooms][1];
    const raid = raids.get(raidId);
    
    if (!raid) return;

    console.log(`턴 ${raid.turn + 1} 명령 실행:`, commands.length);

    // 1. 공대원 행동 실행
    commands.forEach(cmd => {
      const character = raid.party.find(c => c.id === cmd.characterId);
      if (!character) return;

      if (cmd.action === 'move') {
        character.position = cmd.target;
      } else if (cmd.action === 'attack') {
        const damage = calculateDamage(character, 'basic');
        raid.boss.hp -= damage;
        
        io.to(raidId).emit('chatMessage', {
          type: 'system',
          text: `${character.name}이(가) 보스에게 ${damage} 피해!`,
          timestamp: Date.now()
        });
      } else if (cmd.action === 'skill') {
        const skill = character.skills.find(s => s.id === cmd.skillId);
        if (skill && character.mp >= skill.cost) {
          character.mp -= skill.cost;
          
          if (cmd.target === 'boss') {
            const damage = calculateDamage(character, 'skill', skill);
            raid.boss.hp -= damage;
            
            io.to(raidId).emit('chatMessage', {
              type: 'system',
              text: `${character.name}이(가) ${skill.name} 사용! 보스에게 ${damage} 피해!`,
              timestamp: Date.now()
            });
          } else {
            // 힐/버프 스킬
            const target = raid.party.find(c => c.id === cmd.target);
            if (target && skill.id === 'heal') {
              const heal = 300;
              target.hp = Math.min(target.hp + heal, target.maxHp);
              
              io.to(raidId).emit('chatMessage', {
                type: 'system',
                text: `${character.name}이(가) ${target.name}에게 ${skill.name}! HP +${heal}`,
                timestamp: Date.now()
              });
            }
          }
        }
      }
    });

    // 2. 보스 턴 실행
    const bossTurn = raid.turn % raid.boss.pattern.cycle;
    const bossAction = raid.boss.pattern.actions.find(a => a.turnMod === bossTurn);
    
    if (bossAction) {
      let damage = bossAction.damage;
      
      // 광폭화 체크
      if (raid.turn >= raid.boss.maxTurns) {
        raid.isEnraged = true;
        damage *= raid.boss.enrage.attackMultiplier;
        
        if (raid.turn === raid.boss.maxTurns) {
          io.to(raidId).emit('chatMessage', {
            type: 'system',
            text: raid.boss.enrage.message,
            timestamp: Date.now()
          });
        }
      }

      if (bossAction.target === 'tank') {
        const tank = raid.party.find(c => c.role === 'tank');
        if (tank) {
          tank.hp -= damage;
          
          io.to(raidId).emit('chatMessage', {
            type: 'system',
            text: `보스가 ${bossAction.skill} 사용! ${tank.name}에게 ${damage} 피해!`,
            timestamp: Date.now()
          });
        }
      }
    }

    // 3. 턴 증가
    raid.turn++;

    // 4. 승패 판정
    if (raid.boss.hp <= 0) {
      raid.status = 'completed';
      io.to(raidId).emit('chatMessage', {
        type: 'system',
        text: '🎉 레이드 클리어! 축하합니다!',
        timestamp: Date.now()
      });
    } else if (raid.party.every(c => c.hp <= 0)) {
      raid.status = 'failed';
      io.to(raidId).emit('chatMessage', {
        type: 'system',
        text: '💀 레이드 실패... 전멸했습니다.',
        timestamp: Date.now()
      });
    }

    // 5. 업데이트된 상태 전송
    io.to(raidId).emit('gameState', raid);
  });

  socket.on('chatMessage', ({ userId, text }) => {
    const raidId = [...socket.rooms][1];
    
    io.to(raidId).emit('chatMessage', {
      type: 'user',
      username: userId, // TODO: 실제 유저 이름
      text,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// 데미지 계산 헬퍼
function calculateDamage(character, type, skill = null) {
  if (type === 'basic') {
    return character.role === 'tank' ? 100 : 200;
  } else if (type === 'skill' && skill) {
    return skill.id === 'heal' ? 0 : 300; // 간단한 스킬 데미지
  }
  return 100;
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🎮 레이드 서버 시작: http://localhost:${PORT}`);
});

module.exports = { io, raids };
