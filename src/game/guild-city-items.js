// 길드 도시 NPC 상점 아이템 정의

const CITY_ITEMS = {
  // ===== 고급 포션 =====
  mega_hp_potion: {
    key: 'mega_hp_potion',
    name: '메가 HP 포션',
    emoji: '💊',
    type: 'potion',
    effect: 'heal_hp',
    power: 500, // 일반 HP 포션(100)의 5배
    memberPrice: 250, // 길드원 가격
    guestPrice: 1000, // 외부인 가격
    materials: [
      { type: 'wood', name: '나무', qty: 50 },
      { type: 'herb', name: '약초', qty: 30 },
    ],
    outputQty: 5, // 재료 1세트 → 포션 5개
    description: '강력한 HP 회복 포션 (HP +500)',
  },

  mega_mp_potion: {
    key: 'mega_mp_potion',
    name: '메가 MP 포션',
    emoji: '🔷',
    type: 'potion',
    effect: 'heal_mp',
    power: 300, // 일반 MP 포션(50)의 6배
    memberPrice: 200,
    guestPrice: 800,
    materials: [
      { type: 'herb', name: '약초', qty: 40 },
      { type: 'crystal', name: '수정', qty: 20 },
    ],
    outputQty: 5,
    description: '강력한 MP 회복 포션 (MP +300)',
  },

  // ===== 고급 소모품 =====
  legendary_ticket: {
    key: 'legendary_ticket',
    name: '전설 장비 가챠',
    emoji: '🎫',
    type: 'consumable',
    effect: 'attendance_ticket',
    rarity: 'legendary',
    memberPrice: 5000,
    guestPrice: 20000,
    materials: [
      { type: 'iron_ore', name: '철광석', qty: 100 },
      { type: 'mythril', name: '미스릴', qty: 50 },
      { type: 'crystal', name: '수정', qty: 50 },
    ],
    outputQty: 1,
    description: '전설 등급 장비 확정 가챠 티켓',
  },
};

// 재료 타입 정보
const MATERIAL_INFO = {
  wood: { emoji: '🌳', name: '나무' },
  herb: { emoji: '🌿', name: '약초' },
  stone: { emoji: '🪨', name: '돌' },
  iron_ore: { emoji: '⛏️', name: '철광석' },
  crystal: { emoji: '💎', name: '수정' },
  mythril: { emoji: '✨', name: '미스릴' },
};

// 아이템 키로 아이템 찾기
function getCityItem(itemKey) {
  return CITY_ITEMS[itemKey] || null;
}

// 모든 아이템 목록
function getAllCityItems() {
  return Object.values(CITY_ITEMS);
}

// 재료 정보
function getMaterialInfo(materialType) {
  return MATERIAL_INFO[materialType] || { emoji: '📦', name: materialType };
}

module.exports = {
  CITY_ITEMS,
  MATERIAL_INFO,
  getCityItem,
  getAllCityItems,
  getMaterialInfo,
};
