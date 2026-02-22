const { randomInt } = require('./monsters');

// 랜덤 이벤트 종류
const EVENT_TYPES = {
  treasure: {
    key: 'treasure',
    name: '보물 상자',
    emoji: '💎',
    chance: 0.2, // 20%
  },
  trap: {
    key: 'trap',
    name: '함정',
    emoji: '🕳️',
    chance: 0.15, // 15%
  },
  merchant: {
    key: 'merchant',
    name: '상인',
    emoji: '🧙',
    chance: 0.1, // 10%
  },
  lucky: {
    key: 'lucky',
    name: '행운의 순간',
    emoji: '🍀',
    chance: 0.05, // 5%
  },
};

// 랜덤 이벤트 발생 여부 체크
function shouldTriggerEvent() {
  // 전투 시작 전 50% 확률로 이벤트 체크
  return Math.random() < 0.5;
}

// 이벤트 타입 결정
function rollEventType() {
  const roll = Math.random();
  let cumulative = 0;

  // 확률 순으로 체크 (낮은 확률부터)
  const sortedEvents = Object.values(EVENT_TYPES).sort((a, b) => a.chance - b.chance);

  for (const event of sortedEvents) {
    cumulative += event.chance;
    if (roll < cumulative) {
      return event.key;
    }
  }

  return null; // 이벤트 없음
}

// 보물 상자 이벤트
function generateTreasureEvent(characterLevel) {
  const goldAmount = randomInt(100, 300) + characterLevel * 10;
  const potionsAmount = randomInt(1, 2);

  return {
    type: 'treasure',
    emoji: '💎',
    title: '보물 상자를 발견했습니다!',
    description: [
      '✨ 숲 속에서 빛나는 보물 상자를 발견했습니다!',
      '',
      '🎁 획득한 보상:',
      `💰 골드 +${goldAmount}G`,
      `💊 포션 +${potionsAmount}개`,
    ].join('\n'),
    rewards: {
      gold: goldAmount,
      potions: potionsAmount,
    },
  };
}

// 함정 이벤트
function generateTrapEvent(character) {
  const damage = randomInt(10, 30);
  const actualDamage = Math.min(damage, character.hp - 1); // 죽지 않도록

  return {
    type: 'trap',
    emoji: '🕳️',
    title: '함정에 걸렸습니다!',
    description: [
      '💥 바닥의 함정이 발동했습니다!',
      '',
      `❤️ 체력 -${actualDamage} HP`,
      '💊 포션으로 회복하는 것을 잊지 마세요!',
    ].join('\n'),
    damage: actualDamage,
  };
}

// 상인 이벤트
function generateMerchantEvent() {
  const potionPrice = 50;
  const elixirPrice = 200; // HP/MP 완전 회복

  return {
    type: 'merchant',
    emoji: '🧙',
    title: '떠돌이 상인을 만났습니다!',
    description: [
      '🧙 "여행자여, 내 물건을 보고 가시게!"',
      '',
      '🛒 상인의 상품:',
      `💊 포션 - ${potionPrice}G (체력 35% 회복)`,
      `🧪 엘릭서 - ${elixirPrice}G (HP/MP 완전 회복)`,
      '',
      '💡 아직 구매 기능은 준비중입니다...',
    ].join('\n'),
    items: [
      { name: '포션', price: potionPrice, effect: 'hp_35' },
      { name: '엘릭서', price: elixirPrice, effect: 'full_heal' },
    ],
  };
}

// 행운의 순간 이벤트
function generateLuckyEvent() {
  return {
    type: 'lucky',
    emoji: '🍀',
    title: '행운의 여신이 미소짓습니다!',
    description: [
      '✨ 신비로운 힘이 당신을 감싸고 있습니다!',
      '',
      '🎯 다음 전투에서 특별한 효과:',
      '💥 크리티컬 확률 +50%',
      '⚡ 공격력 +20%',
      '🛡️ 방어력 +20%',
      '',
      '🍀 이 버프는 다음 전투 한 번만 적용됩니다!',
    ].join('\n'),
    buff: {
      critBonus: 0.5,
      attackBonus: 0.2,
      defenseBonus: 0.2,
      duration: 1, // 1번의 전투
    },
  };
}

// 이벤트 생성
function generateEvent(character) {
  const eventType = rollEventType();

  if (!eventType) {
    return null;
  }

  switch (eventType) {
    case 'treasure':
      return generateTreasureEvent(character.level);
    case 'trap':
      return generateTrapEvent(character);
    case 'merchant':
      return generateMerchantEvent();
    case 'lucky':
      return generateLuckyEvent();
    default:
      return null;
  }
}

// 이벤트 보상 적용
function applyEventRewards(character, event) {
  const updates = {};

  if (event.type === 'treasure') {
    updates.gold = (character.gold || 0) + event.rewards.gold;
    // 포션은 전투 시작 시 추가됨
  }

  if (event.type === 'trap') {
    updates.hp = Math.max(1, character.hp - event.damage);
  }

  return updates;
}

module.exports = {
  EVENT_TYPES,
  shouldTriggerEvent,
  rollEventType,
  generateEvent,
  applyEventRewards,
};
