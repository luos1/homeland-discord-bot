# 이모지 버튼 네비게이션 시스템

## 핵심 원칙
**명령어 입력 없이 버튼만으로 게임 플레이 가능하게!**

모든 응답 메시지에 다음 액션 버튼을 항상 표시

---

## 각 화면별 버튼 구성

### 1. 캐릭터 생성 완료 (`/create`)
```
✅ 전사 캐릭터 생성 완료!

[⚔️ 탐험 시작] [📊 프로필 보기]
```

### 2. 프로필 화면 (`/profile`)
```
📊 캐릭터 프로필
이름: OOO | 클래스: 전사
레벨: 5 | XP: 450/500

[⚔️ 탐험] [🎒 인벤토리] [🏪 상점] [📈 새로고침]
```

### 3. 탐험 존 선택
```
⚔️ 어디로 탐험할까요?

[🌲 Zone 1] [⛰️ Zone 2] [🏔️ Zone 3]
[📊 프로필]
```

### 4. 전투 중
```
💀 고블린 출현!
고블린 HP: 80/100 | 당신 HP: 150/150

[⚔️ 공격] [🛡️ 방어] [💊 포션] [🏃 도망]
```

### 5. 전투 승리
```
✅ 승리! 경험치 +50, 골드 +30

[⚔️ 계속 탐험] [📊 프로필] [🏠 돌아가기]
```

### 6. 전투 패배/도망
```
💀 패배... HP가 50%로 회복되었습니다.

[⚔️ 다시 도전] [📊 프로필] [🏠 마을]
```

---

## 구현 상세

### 공통 버튼 세트
모든 메시지에 기본 네비게이션 추가:

```javascript
// 항상 추가되는 기본 버튼
const baseButtons = [
  { emoji: '⚔️', label: '탐험', customId: 'action_explore' },
  { emoji: '📊', label: '프로필', customId: 'action_profile' },
];
```

### 상황별 추가 버튼
각 상황에 맞는 버튼 추가:

**전투 버튼**
```javascript
[
  { emoji: '⚔️', label: '공격', customId: 'combat_attack' },
  { emoji: '🛡️', label: '방어', customId: 'combat_defend' },
  { emoji: '💊', label: '포션', customId: 'combat_potion' },
  { emoji: '🏃', label: '도망', customId: 'combat_flee' },
]
```

**존 선택 버튼**
```javascript
[
  { emoji: '🌲', label: 'Zone 1', customId: 'zone_1' },
  { emoji: '⛰️', label: 'Zone 2', customId: 'zone_2' },
  { emoji: '🏔️', label: 'Zone 3', customId: 'zone_3' },
  { emoji: '📊', label: '프로필', customId: 'action_profile' },
]
```

**프로필 버튼**
```javascript
[
  { emoji: '⚔️', label: '탐험', customId: 'action_explore' },
  { emoji: '🎒', label: '인벤토리', customId: 'action_inventory', disabled: true },
  { emoji: '🏪', label: '상점', customId: 'action_shop', disabled: true },
  { emoji: '📈', label: '새로고침', customId: 'action_refresh' },
]
```

---

## 버튼 핸들러 구조

`src/bot.js`에 통합 버튼 라우터:

```javascript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const [category, action] = interaction.customId.split('_');
  
  switch (category) {
    case 'action':
      // 공통 액션 (탐험, 프로필, 인벤토리, 상점)
      await handleAction(interaction, action);
      break;
    case 'zone':
      // 존 선택 → 전투 시작
      await startCombat(interaction, action);
      break;
    case 'combat':
      // 전투 액션
      await handleCombat(interaction, action);
      break;
    case 'profile':
      // 프로필 관련 액션
      await handleProfile(interaction, action);
      break;
  }
});
```

---

## 수정 파일 목록

1. **src/commands/create.js**
   - 생성 완료 메시지에 [⚔️ 탐험 시작] [📊 프로필] 버튼 추가

2. **src/commands/profile.js**
   - [⚔️ 탐험] [🎒 인벤토리] [🏪 상점] [📈 새로고침] 버튼 추가

3. **src/commands/explore.js**
   - 존 선택 화면에 버튼 추가

4. **src/game/combat.js**
   - 전투 승리/패배 메시지에 다음 액션 버튼 추가

5. **src/bot.js**
   - 통합 버튼 핸들러 구현
   - 모든 버튼 라우팅

---

## 사용자 경험 플로우 (예시)

1. `/create class:warrior` 입력
2. ✅ 생성 완료 → [⚔️ 탐험 시작] 클릭
3. 존 선택 화면 → [🌲 Zone 1] 클릭
4. 전투 시작 → [⚔️ 공격] 반복 클릭
5. 승리 → [⚔️ 계속 탐험] 클릭
6. 다시 존 선택 → 반복

**명령어 입력 없이 버튼만으로 계속 플레이 가능!**

---

**즉시 구현하세요!**
