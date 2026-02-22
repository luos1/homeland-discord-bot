# HOMELAND UX 강화 + 완전 한글화

## 현재 문제점
- ❌ 영문 메시지 많음
- ❌ 정보가 밋밋함
- ❌ 시각적 재미 부족
- ❌ 게임 느낌 안 남

---

## UX 강화 방향

### 1. 완전 한글화
**모든 영문 → 한글 전환**

### 2. 이모지 적극 활용
- HP 바 시각화
- 스탯 아이콘
- 전투 연출

### 3. 정보 구조화
- 중요 정보 강조
- 여백과 구분선
- 읽기 쉬운 레이아웃

---

## 화면별 UX 개선

### ✅ 캐릭터 생성 (Before/After)

**Before (현재)**
```
Created warrior character!
Name: OOO
HP: 100, Attack: 10, Defense: 5
```

**After (개선)**
```
⚔️ 전사 캐릭터 생성 완료!

━━━━━━━━━━━━━━━━━━
📛 이름: OOO
⚔️ 직업: 전사
━━━━━━━━━━━━━━━━━━

📊 초기 능력치
❤️ 체력: 100/100
⚔️ 공격력: 15
🛡️ 방어력: 8
💰 골드: 0

🎯 전투를 시작해보세요!

[⚔️ 탐험 시작] [📊 프로필 보기]
```

---

### 📊 프로필 (Before/After)

**Before (현재)**
```
📜 Character - Profile
Class / Level: Warrior / 5
Gold: 250
Status: Idle
Battle Stats: HP 150/150, ATK 10, DEF 5
XP Progress: 450/500 (50 to level up)
```

**After (개선)**
```
⚔️ OOO님의 전사

━━━━━━━━━━━━━━━━━━
💎 레벨 5 | 💰 골드 250G
━━━━━━━━━━━━━━━━━━

📊 전투 능력치
❤️ 체력: ████████░░ 150/150
⚔️ 공격력: 25
🛡️ 방어력: 12
💥 크리티컬: 5%

📈 경험치
▓▓▓▓▓▓▓▓▓░ 450/500 (90%)
🎯 다음 레벨까지 50 남음

🎮 현재 상태: 마을에서 휴식 중

[⚔️ 탐험] [🎒 인벤토리] [🏪 상점] [📈 새로고침]
```

---

### ⚔️ 전투 시작 (Before/After)

**Before (현재)**
```
Select your combat zone:
Zone 1 / Zone 2 / Zone 3
```

**After (개선)**
```
⚔️ 어디로 탐험을 떠날까요?

━━━━━━━━━━━━━━━━━━
🌲 초보자 숲 (Zone 1)
   권장 레벨: 1-10
   몬스터: 스켈레톤, 다이어울프
   보상: ⭐

⛰️ 어둠의 동굴 (Zone 2)
   권장 레벨: 11-25
   몬스터: 언데드 기사, 고블린
   보상: ⭐⭐

🏔️ 죽음의 산맥 (Zone 3)
   권장 레벨: 26-50
   몬스터: 드래곤, 리치
   보상: ⭐⭐⭐
━━━━━━━━━━━━━━━━━━

[🌲 초보자 숲] [⛰️ 어둠의 동굴] [🏔️ 죽음의 산맥]
[📊 프로필]
```

---

### 💀 전투 중 (Before/After)

**Before (현재)**
```
A wild Skeleton Grunt appears!
Skeleton Grunt: 45/45 HP
You: 150/150 HP
Turn 1
```

**After (개선)**
```
💀 전투 시작!

━━━━━━━━━━━━━━━━━━
👹 스켈레톤 그런트 Lv.3
❤️ ████████░░ 45/45 HP
⚔️ 공격력: 10 | 🛡️ 방어력: 3

━━━━━━━━━━━━━━━━━━
⚔️ OOO (전사) Lv.5
❤️ ██████████ 150/150 HP
⚔️ 공격력: 25 | 🛡️ 방어력: 12

━━━━━━━━━━━━━━━━━━
🎲 턴 1 | 🎯 당신의 차례!

[⚔️ 공격] [🛡️ 방어] [💊 포션] [🏃 도망]
```

---

### 💥 공격 결과 (Before/After)

**Before (현재)**
```
You attacked Skeleton Grunt for 15 damage!
Skeleton Grunt: 30/45 HP
```

**After (개선)**
```
⚔️ 당신의 공격!

💥 크리티컬 히트!
━━━━━━━━━━━━━━━━━━
👹 스켈레톤 그런트
   ❤️ ██████░░░░ 30/45 HP
   💔 -15 데미지!

━━━━━━━━━━━━━━━━━━
👹 스켈레톤 그런트의 반격!
⚔️ OOO
   ❤️ █████████░ 142/150 HP
   💔 -8 데미지

━━━━━━━━━━━━━━━━━━
🎲 턴 2 | 🎯 당신의 차례!

[⚔️ 공격] [🛡️ 방어] [💊 포션] [🏃 도망]
```

---

### 🎉 승리 (Before/After)

**Before (현재)**
```
Victory! You defeated Skeleton Grunt!
Gained 24 XP and 15 gold.
```

**After (개선)**
```
🎉 승리!

━━━━━━━━━━━━━━━━━━
✨ 스켈레톤 그런트 처치!

📊 전투 결과
⏱️ 전투 시간: 3턴
❤️ 남은 체력: 142/150 HP

🎁 보상
✨ 경험치 +24
💰 골드 +15G
🎲 아이템 드롭 확인 중...

━━━━━━━━━━━━━━━━━━
📈 레벨 업!

⚔️ Lv.5 → Lv.6
❤️ 최대 체력 +10 (150 → 160)
⚔️ 공격력 +2 (25 → 27)
🛡️ 방어력 +1 (12 → 13)

🎊 축하합니다!
━━━━━━━━━━━━━━━━━━

[⚔️ 계속 탐험] [📊 프로필] [🏠 마을로]
```

---

### 💀 패배/도망 (Before/After)

**Before (현재)**
```
You fled from combat.
HP restored to 75/150.
```

**After (개선)**
```
🏃 전투에서 도망쳤습니다!

━━━━━━━━━━━━━━━━━━
💔 부상을 입었습니다
❤️ 체력: ████░░░░░░ 75/150 HP

🏥 마을에서 회복 중...
💊 체력이 절반으로 회복되었습니다

━━━━━━━━━━━━━━━━━━
💡 팁: 포션을 사용하면 전투 중
    체력을 회복할 수 있습니다!

[⚔️ 다시 도전] [📊 프로필] [🏠 마을에서 휴식]
```

---

## 추가 UX 개선

### 1. HP 바 시각화
```javascript
function createHPBar(current, max, length = 10) {
  const filled = Math.floor((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// 사용 예
❤️ ████████░░ 150/200 HP (75%)
```

### 2. 경험치 바
```javascript
function createXPBar(current, required, length = 10) {
  if (!required) return '▓'.repeat(length) + ' (MAX)';
  const filled = Math.floor((current / required) * length);
  const empty = length - filled;
  const percent = Math.floor((current / required) * 100);
  return `▓${filled}${'░'.repeat(empty)} ${percent}%`;
}

// 사용 예
📈 ▓▓▓▓▓▓▓▓▓░ 90%
```

### 3. 색상 코드 (Embed)
```javascript
// 상황별 색상
const COLORS = {
  victory: 0x00ff00,    // 초록 (승리)
  defeat: 0xff0000,     // 빨강 (패배)
  combat: 0xff6600,     // 주황 (전투)
  profile: 0x2563eb,    // 파랑 (프로필)
  levelUp: 0xffd700,    // 골드 (레벨업)
  rare: 0x9333ea,       // 보라 (희귀 아이템)
};
```

### 4. 구분선 활용
```
━━━━━━━━━━━━━━━━━━  (긴 구분선)
──────────────────  (짧은 구분선)
╔══════════════════╗ (박스 상단)
║ 내용             ║
╚══════════════════╝ (박스 하단)
```

---

## 한글 용어 정리

### 게임 용어
- Character → 캐릭터
- Profile → 프로필
- Combat → 전투
- Victory → 승리
- Defeat → 패배
- Level → 레벨
- Experience → 경험치
- Gold → 골드
- Attack → 공격
- Defense → 방어
- HP → 체력
- Turn → 턴
- Critical → 크리티컬
- Flee → 도망

### 클래스명
- Warrior → 전사
- Ranger → 궁수
- Sorcerer → 마법사

### 몬스터명
- Skeleton Grunt → 스켈레톤 그런트
- Dire Wolf → 다이어울프
- Undead Knight → 언데드 기사
- Goblin Shaman → 고블린 주술사
- Ancient Dragon → 고대 드래곤

### 존명
- Zone 1 → 초보자 숲
- Zone 2 → 어둠의 동굴
- Zone 3 → 죽음의 산맥

### 버튼/명령어
- Explore → 탐험
- Profile → 프로필
- Inventory → 인벤토리
- Shop → 상점
- Stats → 스탯
- Attack → 공격
- Defend → 방어
- Potion → 포션

---

## 구현 파일 목록

1. **src/commands/create.js**
   - 캐릭터 생성 메시지 한글화 + UX 개선

2. **src/commands/profile.js**
   - 프로필 레이아웃 개선
   - HP/XP 바 추가

3. **src/commands/explore.js**
   - 존 선택 화면 개선
   - 존별 설명 추가

4. **src/game/combat.js**
   - 전투 화면 대폭 개선
   - 턴 진행 메시지 개선
   - 승리/패배 화면 개선

5. **src/game/monsters.js**
   - 몬스터명 한글화
   - 존명 한글화

6. **src/utils/ui.js** (신규)
   - createHPBar()
   - createXPBar()
   - createDivider()
   - formatNumber()

---

## Codex 구현 지시

**즉시 구현:**

1. ✅ 모든 영문 메시지 → 한글
2. ✅ HP/XP 바 시각화 함수 추가
3. ✅ 전투 화면 UX 대폭 개선
4. ✅ 승리/패배 화면 개선
5. ✅ 구분선, 이모지 적극 활용
6. ✅ Embed 색상 상황별 적용

**완료 후:**
- 봇 재시작
- 형아 테스트

---

**즉시 구현할까요?**
