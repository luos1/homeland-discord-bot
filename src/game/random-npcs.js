// 랜덤 NPC 시스템

/**
 * 랜덤 NPC 정의
 */
const RANDOM_NPCS = {
  wandering_merchant: {
    key: 'wandering_merchant',
    name: '떠돌이 상인',
    emoji: '🛒',
    description: '떠돌이 상인이 마을에 들렀습니다! 특가 아이템을 판매합니다.',
    durationMinutes: 30,
    
    dialogue: {
      greeting: [
        '안녕하시오! 떠돌이 상인 밥이오.',
        '특별한 아이템을 가져왔소!',
        '',
        '지금만 특가로 판매합니다!',
        '⏰ 30분 후 떠납니다.',
      ].join('\n'),
      
      purchase: '좋은 선택이오! 행운을 빕니다.',
      
      farewell: '떠돌이 상인이 다음 마을로 떠났습니다...',
    },
    
    items: [
      {
        name: '고급 회복 물약',
        emoji: '🧪',
        description: 'HP 100 즉시 회복',
        normalPrice: 1000,
        discountPrice: 500,
        type: 'consumable',
        effect: 'heal_100',
      },
      {
        name: '경험치 부스터',
        emoji: '⭐',
        description: '1시간 동안 경험치 +50%',
        normalPrice: 3000,
        discountPrice: 1500,
        type: 'buff',
        effect: 'xp_boost_50',
        durationMinutes: 60,
      },
      {
        name: '행운의 부적',
        emoji: '🍀',
        description: '1시간 동안 아이템 드랍율 +30%',
        normalPrice: 2500,
        discountPrice: 1200,
        type: 'buff',
        effect: 'drop_boost_30',
        durationMinutes: 60,
      },
    ],
  },
  
  mysterious_elder: {
    key: 'mysterious_elder',
    name: '신비한 노인',
    emoji: '🧙',
    description: '신비한 노인이 나타났습니다! 모험가들에게 축복을 내립니다.',
    durationMinutes: 15,
    
    dialogue: {
      greeting: [
        '젊은 모험가여...',
        '나의 축복을 받아가거라.',
        '',
        '선택은 단 한 번뿐이니라.',
        '⏰ 15분 후 사라집니다.',
      ].join('\n'),
      
      blessing: '축복을 받았습니다. 행운이 함께 하기를...',
      
      farewell: '신비한 노인이 연기처럼 사라졌습니다...',
    },
    
    blessings: [
      {
        name: '힘의 축복',
        emoji: '⚔️',
        description: '2시간 동안 공격력 +20%',
        type: 'buff',
        effect: 'attack_boost_20',
        durationMinutes: 120,
      },
      {
        name: '방어의 축복',
        emoji: '🛡️',
        description: '2시간 동안 방어력 +20%',
        type: 'buff',
        effect: 'defense_boost_20',
        durationMinutes: 120,
      },
      {
        name: '부의 축복',
        emoji: '💰',
        description: '골드 +5,000G 즉시 지급',
        type: 'instant',
        goldReward: 5000,
      },
      {
        name: '지혜의 축복',
        emoji: '📖',
        description: '경험치 +3,000 즉시 지급',
        type: 'instant',
        xpReward: 3000,
      },
    ],
  },
  
  gambler: {
    key: 'gambler',
    name: '도박꾼',
    emoji: '🎲',
    description: '수상한 도박꾼이 나타났습니다! 행운을 시험해보시겠습니까?',
    durationMinutes: 60,
    
    dialogue: {
      greeting: [
        '크크크... 운을 시험하고 싶은가?',
        '골드를 걸어라. 내가 2배로 만들어주지.',
        '',
        '...물론 잃을 수도 있지만 말이야.',
        '⏰ 1시간 후 떠납니다.',
      ].join('\n'),
      
      win: '...운이 좋군. 이번엔 자네 승리다!',
      
      lose: '크크크! 내 승리야. 다음에 또 보자고!',
      
      farewell: '도박꾼이 웃으며 사라졌습니다...',
    },
    
    gambleOptions: [
      { amount: 1000, label: '1,000G 배팅' },
      { amount: 5000, label: '5,000G 배팅' },
      { amount: 10000, label: '10,000G 배팅' },
      { amount: 50000, label: '50,000G 배팅 (올인!)' },
    ],
    
    winChance: 0.5, // 50% 확률
  },
};

/**
 * 랜덤 NPC 스폰 확률 및 타이밍
 */
const SPAWN_CONFIG = {
  minSpawnIntervalHours: 6, // 최소 6시간 간격
  maxSpawnIntervalHours: 12, // 최대 12시간 간격
  spawnChance: 0.3, // 체크 시 30% 확률로 스폰
  
  // NPC 타입별 가중치
  npcWeights: {
    wandering_merchant: 40, // 40%
    mysterious_elder: 35,   // 35%
    gambler: 25,            // 25%
  },
};

/**
 * 가중치 기반 랜덤 NPC 선택
 */
function selectRandomNpc() {
  const weights = SPAWN_CONFIG.npcWeights;
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (const [npcKey, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return npcKey;
    }
  }
  
  return 'wandering_merchant'; // fallback
}

/**
 * NPC 소멸 시간 계산
 */
function calculateExpiryTime(npcType) {
  const npc = RANDOM_NPCS[npcType];
  if (!npc) return new Date(Date.now() + 30 * 60 * 1000); // 기본 30분
  
  return new Date(Date.now() + npc.durationMinutes * 60 * 1000);
}

module.exports = {
  RANDOM_NPCS,
  SPAWN_CONFIG,
  selectRandomNpc,
  calculateExpiryTime,
};
