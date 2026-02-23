# 직업 재전직 시스템 (Job Respec System)

## 개요
전직 완료 후 골드를 지불하고 직업을 변경할 수 있는 시스템.
전투 직업 / 생산 직업 각각 독립적으로 변경 가능.

## 요구사항
- ✅ **버튼 UI 필수** (슬래시 명령어 아님)
- ✅ **마을에서만 가능** (/village 메뉴 통합)
- ✅ **골드 비용 차감**
- ✅ **숙련도 유지** (직업 변경해도 누적치는 보존)
- ✅ **경제 시스템 연동** (향후 동적 가격 적용)

## 비용 체계

### 초기 고정 비용
```js
const JOB_RESPEC_COST = {
  combat: 5000,      // 전투 직업 변경 비용
  production: 3000,  // 생산 직업 변경 비용
};
```

### 향후 동적 가격 (Phase 2)
- 월드 경제 시스템 영향 받음
- 총 전직 횟수에 따라 비용 증가 (예: 2차 5000G → 3차 8000G)
- 서버 활성도에 따라 변동
- FeeConfig 모델 통합

## UI/UX 흐름

### 1. 마을 메뉴 진입
```
/village
├── [⚔️ 전투]
├── [🔨 생산]
├── [🏪 상점]
└── [💼 직업 관리] ⬅ 신규 버튼
```

### 2. 직업 관리 메뉴
```
💼 직업 관리

현재 직업:
⚔️ 전투: 전사 Lv.45 (숙련도: 전사 78, 레인저 32, 마법사 0)
🔨 생산: 연금술사 Lv.20 (숙련도: 채집가 50, 대장장이 15, 연금술사 20)

[⚔️ 전투 직업 변경] (5,000G)
[🔨 생산 직업 변경] (3,000G)
[🏘️ 마을로]
```

### 3. 전투 직업 변경
```
⚔️ 전투 직업 변경

비용: 5,000G (보유: 12,500G)
⚠️ 레벨과 경험치는 유지되지만, 직업 특성은 변경됩니다.
✅ 숙련도는 모두 보존됩니다.

변경할 직업을 선택하세요:

[⚔️ 전사] [🏹 레인저] [🔮 마법사]
[🔙 돌아가기]
```

### 4. 확인 단계
```
정말 레인저로 변경하시겠습니까?

현재: 전사 Lv.45
변경: 레인저 Lv.45

비용: 5,000G
보유: 12,500G → 7,500G

[✅ 확인] [❌ 취소]
```

## 구현 위치

### 파일 구조
```
src/commands/job_respec.js       (신규)
src/game/job-respec.js           (신규, 로직)
tests/commands/job_respec.test.js (신규)
```

### Village 통합
`src/commands/village.js`에 [💼 직업 관리] 버튼 추가:
```js
const JOB_MANAGE_BUTTON = new ButtonBuilder()
  .setCustomId('village:job_manage')
  .setLabel('직업 관리')
  .setEmoji('💼')
  .setStyle(ButtonStyle.Secondary);
```

## 데이터 모델

### Character 필드 (기존)
```prisma
model Character {
  class           String   // 현재 전투 직업
  level           Int
  xp              Int
  productionClass String?  // 현재 생산 직업
  productionLevel Int
  productionXp    Int
  
  // 숙련도 (직업 변경해도 유지)
  warriorMastery     Int @default(0)
  rangerMastery      Int @default(0)
  mageMastery        Int @default(0)
  gathererMastery    Int @default(0)
  blacksmithMastery  Int @default(0)
  alchemistMastery   Int @default(0)
}
```

### JobRespecHistory 모델 (선택사항, 통계용)
```prisma
model JobRespecHistory {
  id          Int      @id @default(autoincrement())
  characterId Int
  character   Character @relation(fields: [characterId], references: [id])
  
  jobType     String   // "combat" | "production"
  fromClass   String   // "warrior"
  toClass     String   // "ranger"
  cost        Int      // 5000
  
  createdAt   DateTime @default(now())
  
  @@index([characterId])
  @@index([createdAt])
}
```

## 제약사항

### 변경 가능한 직업
- **전투**: warrior, ranger, mage (3종)
- **생산**: gatherer, blacksmith, alchemist (3종)

### 변경 시 유지되는 것
- ✅ 레벨 (level, productionLevel)
- ✅ 경험치 (xp, productionXp)
- ✅ 모든 숙련도
- ✅ 장비 (단, 직업 제약 있는 장비는 착용 불가)
- ✅ 스킬 (단, 직업 제약 있는 스킬은 사용 불가)

### 변경 시 초기화되는 것
- ❌ 현재 전투 세션 (진행 중인 전투는 취소됨)
- ❌ 생산 세션 (진행 중인 채집/제작은 취소됨)

## 향후 확장

### Phase 2: 동적 가격
```js
// src/game/job-respec.js
async function getJobRespecCost(character, jobType) {
  const baseCost = JOB_RESPEC_COST[jobType];
  
  // 전직 횟수에 따른 증가
  const respecCount = await prisma.jobRespecHistory.count({
    where: { characterId: character.id, jobType },
  });
  const countMultiplier = 1 + (respecCount * 0.2); // 20%씩 증가
  
  // 서버 경제 상태 반영
  const economyMultiplier = await getEconomyInflationRate();
  
  return Math.floor(baseCost * countMultiplier * economyMultiplier);
}
```

### Phase 3: 3차 전직 조건
```js
// 예: 전사 → 버서커 (3차)
const ADVANCED_JOB_REQUIREMENTS = {
  berserker: {
    baseClass: 'warrior',
    minLevel: 50,
    minMastery: 100,      // warriorMastery >= 100
    cost: 20000,
  },
  sniper: {
    baseClass: 'ranger',
    minLevel: 50,
    minMastery: 100,      // rangerMastery >= 100
    cost: 20000,
  },
  // ...
};
```

## 테스트 시나리오

### 기본 흐름
1. 전사 Lv.30 캐릭터 생성 (골드 10,000G)
2. /village → [💼 직업 관리] 클릭
3. [⚔️ 전투 직업 변경] 클릭
4. [🏹 레인저] 선택
5. [✅ 확인] 클릭
6. ✅ 직업이 레인저로 변경됨
7. ✅ 골드 5,000G 차감 (잔액 5,000G)
8. ✅ 레벨 30 유지
9. ✅ 전사 숙련도 보존

### 에러 케이스
- ❌ 골드 부족 (5,000G 미만)
- ❌ 현재와 동일한 직업 선택
- ❌ 전투 중 변경 시도
- ❌ 생산 중 변경 시도

## 구현 우선순위
1. ✅ UI/UX 설계 (완료)
2. ⏳ 코어 로직 구현
3. ⏳ Village 메뉴 통합
4. ⏳ 테스트 작성
5. ⏳ E2E 테스트
6. ⏳ Railway 배포

---

**담당자**: Maru (AI Assistant)
**작성일**: 2026-02-23
**상태**: 설계 완료, 구현 대기
