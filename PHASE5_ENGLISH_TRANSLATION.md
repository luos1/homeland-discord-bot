# 🌍 Phase 5: 영문 번역 가이드

**날짜**: 2026-02-25  
**목표**: 명령어, 시스템 메시지, 아이템/몬스터 이름 영문화 (50%+)

---

## 📋 번역 우선순위

### Priority 1: 명령어 설명 (필수) ✅
- `/create` - Character creation
- `/profile` - View character stats
- `/explore` - Start adventure
- `/attack` - Combat action
- `/market` - Buy/sell items

### Priority 2: 시스템 메시지 (중요) 🟡
- 전투 메시지
- 레벨업 메시지
- 거래 메시지
- 에러 메시지

### Priority 3: 아이템/몬스터 이름 (선택) ⏸️
- 몬스터 이름 (고블린 → Goblin)
- 아이템 이름 (철검 → Iron Sword)
- 스킬 이름 (화염구 → Fireball)

---

## 🎯 번역 계획 (2시간)

### 1단계: 명령어 설명 (30분)

#### Before (한글)
```javascript
// src/commands/create.js
.setDescription('새로운 캐릭터를 생성합니다')
```

#### After (이중 언어)
```javascript
// src/commands/create.js
const translations = {
  ko: '새로운 캐릭터를 생성합니다',
  en: 'Create a new character',
};

.setDescription(translations[locale] || translations.ko)
```

#### 주요 명령어 번역표
```javascript
const COMMAND_TRANSLATIONS = {
  create: {
    ko: '새로운 캐릭터를 생성합니다',
    en: 'Create a new character',
  },
  profile: {
    ko: '캐릭터 정보를 확인합니다',
    en: 'View your character profile',
  },
  explore: {
    ko: '탐험을 시작합니다',
    en: 'Start exploring',
  },
  attack: {
    ko: '공격합니다',
    en: 'Attack',
  },
  defend: {
    ko: '방어합니다',
    en: 'Defend',
  },
  market: {
    ko: '상점을 엽니다',
    en: 'Open the market',
  },
  inventory: {
    ko: '인벤토리를 확인합니다',
    en: 'View your inventory',
  },
  guild: {
    ko: '길드를 확인합니다',
    en: 'View guilds',
  },
};
```

---

### 2단계: 시스템 메시지 (1시간)

#### 전투 메시지
```javascript
// src/game/combat.js
const COMBAT_MESSAGES = {
  victory: {
    ko: '🎉 승리했습니다!',
    en: '🎉 Victory!',
  },
  defeat: {
    ko: '💀 패배했습니다...',
    en: '💀 Defeated...',
  },
  critical: {
    ko: '💥 크리티컬!',
    en: '💥 Critical Hit!',
  },
  evade: {
    ko: '💨 회피!',
    en: '💨 Evaded!',
  },
  levelUp: {
    ko: '⬆️ 레벨업!',
    en: '⬆️ Level Up!',
  },
};
```

#### 레벨업 메시지
```javascript
const LEVELUP_MESSAGES = {
  congratulations: {
    ko: '축하합니다! 레벨 {level}에 도달했습니다!',
    en: 'Congratulations! You reached Level {level}!',
  },
  statsIncreased: {
    ko: '능력치가 증가했습니다',
    en: 'Stats increased',
  },
  hp: {
    ko: '체력',
    en: 'HP',
  },
  attack: {
    ko: '공격력',
    en: 'Attack',
  },
  defense: {
    ko: '방어력',
    en: 'Defense',
  },
};
```

#### 에러 메시지
```javascript
const ERROR_MESSAGES = {
  characterNotFound: {
    ko: '캐릭터를 찾을 수 없습니다. `/create`로 생성하세요.',
    en: 'Character not found. Use `/create` to create one.',
  },
  insufficientGold: {
    ko: '골드가 부족합니다.',
    en: 'Insufficient gold.',
  },
  invalidAction: {
    ko: '유효하지 않은 행동입니다.',
    en: 'Invalid action.',
  },
  sessionExpired: {
    ko: '세션이 만료되었습니다.',
    en: 'Session expired.',
  },
};
```

---

### 3단계: 몬스터/아이템 이름 (30분)

#### 몬스터 번역표
```javascript
const MONSTER_NAMES = {
  고블린: {
    ko: '고블린',
    en: 'Goblin',
  },
  오크: {
    ko: '오크',
    en: 'Orc',
  },
  트롤: {
    ko: '트롤',
    en: 'Troll',
  },
  드래곤: {
    ko: '드래곤',
    en: 'Dragon',
  },
  슬라임: {
    ko: '슬라임',
    en: 'Slime',
  },
  늑대: {
    ko: '늑대',
    en: 'Wolf',
  },
  '악마의 사냥꾼': {
    ko: '악마의 사냥꾼',
    en: 'Demon Hunter',
  },
  '그림자 군주': {
    ko: '그림자 군주',
    en: 'Shadow Lord',
  },
};
```

#### 아이템 번역표
```javascript
const ITEM_NAMES = {
  '나무 검': {
    ko: '나무 검',
    en: 'Wooden Sword',
  },
  '철검': {
    ko: '철검',
    en: 'Iron Sword',
  },
  '강철 검': {
    ko: '강철 검',
    en: 'Steel Sword',
  },
  '가죽 갑옷': {
    ko: '가죽 갑옷',
    en: 'Leather Armor',
  },
  '철 갑옷': {
    ko: '철 갑옷',
    en: 'Iron Armor',
  },
  '체력 포션': {
    ko: '체력 포션',
    en: 'Health Potion',
  },
  '마나 포션': {
    ko: '마나 포션',
    en: 'Mana Potion',
  },
};
```

---

## 🛠️ 구현 방법

### 방법 1: 간단한 i18n 시스템

#### 1. 번역 파일 생성
```javascript
// src/i18n/translations.js
module.exports = {
  ko: {
    combat: {
      victory: '🎉 승리했습니다!',
      defeat: '💀 패배했습니다...',
      critical: '💥 크리티컬!',
    },
    commands: {
      create: '새로운 캐릭터를 생성합니다',
      profile: '캐릭터 정보를 확인합니다',
    },
  },
  en: {
    combat: {
      victory: '🎉 Victory!',
      defeat: '💀 Defeated...',
      critical: '💥 Critical Hit!',
    },
    commands: {
      create: 'Create a new character',
      profile: 'View your character profile',
    },
  },
};
```

#### 2. 번역 헬퍼 함수
```javascript
// src/utils/i18n.js
const translations = require('../i18n/translations');

function t(key, locale = 'ko', params = {}) {
  const keys = key.split('.');
  let value = translations[locale];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  if (!value) {
    value = translations.ko[keys[0]]?.[keys[1]]; // Fallback to Korean
  }
  
  // Replace params
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      value = value.replace(`{${param}}`, params[param]);
    });
  }
  
  return value || key;
}

module.exports = { t };
```

#### 3. 사용 예시
```javascript
// src/game/combat.js
const { t } = require('../utils/i18n');

// Get user's locale (default: 'ko')
const locale = character.locale || 'ko';

// Use translation
const message = t('combat.victory', locale);
console.log(message); // 🎉 Victory! (if locale = 'en')
```

---

### 방법 2: Discord Native i18n (권장)

Discord는 이미 i18n 시스템을 지원합니다!

```javascript
// src/commands/create.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new character')
    .setDescriptionLocalizations({
      ko: '새로운 캐릭터를 생성합니다',
      ja: '新しいキャラクターを作成します',
    }),
  // ...
};
```

---

## 📊 번역 진행률 추적

### 명령어 (57개)
- [ ] create
- [ ] profile
- [ ] explore
- [ ] attack
- [ ] defend
- [ ] market
- [ ] inventory
- [ ] guild
- [ ] farm
- [ ] auction
- (47개 더...)

### 시스템 메시지 (~200개)
- [ ] 전투 메시지 (50개)
- [ ] 레벨업 메시지 (20개)
- [ ] 경제 메시지 (30개)
- [ ] 에러 메시지 (40개)
- [ ] 기타 (60개)

### 컨텐츠 (~300개)
- [ ] 몬스터 이름 (50개)
- [ ] 아이템 이름 (100개)
- [ ] 스킬 이름 (50개)
- [ ] 퀘스트 텍스트 (100개)

---

## ✅ Phase 5 체크리스트

### 준비 단계 (형아 결정 필요)
- [ ] 번역 방법 선택 (방법 1 vs 방법 2)
- [ ] 지원 언어 결정 (영어만? 일본어도?)
- [ ] 번역 도구 준비 (Google Translate API?)

### 구현 단계 (2시간)
- [ ] i18n 시스템 구현
- [ ] 핵심 명령어 번역 (10개)
- [ ] 주요 시스템 메시지 번역 (50개)
- [ ] 테스트 (영어 명령어 실행)

### 검증 단계
- [ ] 영어 명령어 작동 확인
- [ ] 번역 품질 검토
- [ ] 누락된 번역 확인

---

## 💡 빠른 시작 (최소 구현)

### 1단계: 번역 파일 생성 (10분)
```bash
mkdir -p src/i18n
touch src/i18n/translations.js
```

### 2단계: 핵심 10개 명령어만 번역 (20분)
- create, profile, explore, attack, defend
- market, inventory, guild, farm, auction

### 3단계: Discord Native i18n 적용 (30분)
```javascript
.setDescriptionLocalizations({
  en: 'English description',
})
```

### 4단계: 테스트 (10분)
```
/create (영어 Discord 클라이언트에서 테스트)
```

---

## 🌍 글로벌 런칭 준비도

### 현재 상태
- 🟢 코드: 100% (한글)
- 🟡 명령어: 0% (번역 필요)
- 🟡 메시지: 0% (번역 필요)

### Phase 5 완료 후
- 🟢 코드: 100%
- 🟢 명령어: 100% (영어)
- 🟡 메시지: 50% (핵심 메시지만)

### 글로벌 런칭 후
- 🟢 코드: 100%
- 🟢 명령어: 100%
- 🟢 메시지: 100% (커뮤니티 번역)

---

**서브에이전트**: Jerry v2  
**상태**: Phase 5 가이드 완료 ✅

**다음 단계**: 형아께서 번역 방법을 선택하시면 즉시 구현 가능합니다!
