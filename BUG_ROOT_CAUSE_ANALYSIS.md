# 🔍 버그 근본 원인 분석 및 대응책

## 📋 발생한 문제 목록

### 1. 몬스터 선택 버튼 - Schema 불일치 (2026-02-24 11:02)
**증상:**
```
Unknown argument monsterImageUrl. Available options are marked with ?.
```

**원인:**
- `prisma/schema.prisma`에 `monsterImageUrl` 필드 존재
- **BUT** Prisma Client가 구버전 캐싱
- `prisma db push` 실행했지만 Node.js 프로세스 재시작 안 함

**근본 원인:** Schema 변경 시 자동 반영 메커니즘 부재

---

### 2. Discord Interaction Timeout (2026-02-24 11:56)
**증상:**
```
애플리케이션이 응답하지 않았어요
```

**원인:**
- Discord는 버튼 클릭 후 **3초 안에** 응답 필요
- `handleMonsterSelectButton`에서 DB 쿼리 → Combat Session 생성 → Embed 생성 → 응답
- 총 처리 시간 > 3초

**근본 원인:** 무거운 작업 전 `deferUpdate()` 누락

---

### 3. 봇 크래시 (2026-02-24 11:32)
**증상:**
- 봇 프로세스 종료 (signal 9 또는 unhandled error)

**원인:**
- 에러 핸들링 부재
- Uncaught Promise Rejection

**근본 원인:** Try-catch 누락, 에러 로깅 부재

---

## 🎯 근본 원인 카테고리

### A. **Schema-Code 동기화 문제**
- Prisma schema 변경 후 Client 미갱신
- 타입 불일치 감지 안 됨 (TypeScript 미사용)

### B. **Discord API 제약 미준수**
- 3초 timeout 규칙 모름
- `deferUpdate()` / `deferReply()` 사용 안 함

### C. **에러 핸들링 부재**
- Async 함수에 try-catch 없음
- Uncaught rejection 방치

### D. **테스트 부재**
- 수동 테스트만 진행
- 통합 테스트 없음
- 버튼 클릭 시뮬레이션 없음

---

## 🛡️ 대응책

### 1. 즉시 조치 (Immediate Fix)

#### A. 모든 버튼 핸들러 deferUpdate 추가
```bash
# 모든 버튼 핸들러 함수 찾기
grep -r "async.*Button.*interaction" src/handlers/ src/commands/ src/game/
```

**수정 대상:**
- [ ] handleMonsterSelectButton ✅ (완료)
- [ ] handleZoneSelectButton
- [ ] handleCombatButton
- [ ] handleGuildButton
- [ ] handleTradeButton
- [ ] handleShopButton
- [ ] handleMarketButton
- [ ] handleInventoryButton
- [ ] handleEnhanceButton
- [ ] handleDailyButton
- [ ] 기타 20+ 버튼 핸들러

**패턴:**
```javascript
async function handleXxxButton(interaction, { prisma }) {
  try {
    // 즉시 defer (3초 timeout 방지)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    
    // 실제 작업...
    
    await interaction.editReply({ ... });
  } catch (error) {
    console.error('[ERROR] handleXxxButton:', error);
    // ...
  }
}
```

---

#### B. 전역 에러 핸들러 추가
```javascript
// src/bot.js
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception:', error);
  process.exit(1); // 재시작 필요
});
```

---

#### C. Schema 변경 감지 및 자동 재시작
```javascript
// prisma/watcher.js
const { watch } = require('fs');
const { exec } = require('child_process');

watch('./prisma/schema.prisma', (eventType, filename) => {
  if (eventType === 'change') {
    console.log('[Prisma] Schema changed, regenerating client...');
    exec('npx prisma generate', (error) => {
      if (error) {
        console.error('[Prisma] Generate failed:', error);
        return;
      }
      console.log('[Prisma] Client regenerated. Please restart bot.');
    });
  }
});
```

---

### 2. 단기 조치 (Short-term, 1-2일)

#### A. 버튼 핸들러 표준화
**파일:** `src/utils/button-helper.js`
```javascript
/**
 * 표준 버튼 핸들러 래퍼
 * - 자동 deferUpdate
 * - 자동 에러 핸들링
 * - 타임아웃 감지
 */
async function safeButtonHandler(interaction, handler) {
  const startTime = Date.now();
  
  try {
    // 즉시 defer
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    
    // 실제 핸들러 실행
    await handler(interaction);
    
    const elapsed = Date.now() - startTime;
    if (elapsed > 2000) {
      console.warn(`[PERF] Handler took ${elapsed}ms:`, interaction.customId);
    }
  } catch (error) {
    console.error('[ERROR] Button handler failed:', {
      customId: interaction.customId,
      userId: interaction.user.id,
      error: error.message,
      stack: error.stack,
    });
    
    const errorMsg = `❌ 처리 중 오류가 발생했습니다: ${error.message}`;
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMsg, embeds: [], components: [] });
    } else {
      await interaction.followUp({ content: errorMsg, ephemeral: true });
    }
  }
}

module.exports = { safeButtonHandler };
```

**사용:**
```javascript
const { safeButtonHandler } = require('../utils/button-helper');

// Before:
async function handleMonsterSelectButton(interaction, { prisma }) {
  // 복잡한 로직...
}

// After:
async function handleMonsterSelectButton(interaction, { prisma }) {
  await safeButtonHandler(interaction, async (int) => {
    // 복잡한 로직...
  });
}
```

---

#### B. 통합 테스트 추가
**파일:** `tests/integration/buttons.test.js`
```javascript
const { createMockInteraction } = require('../mocks/discord');
const { handleButton } = require('../../src/handlers/button-router');

describe('Button Handlers', () => {
  it('should defer monster select within 3s', async () => {
    const interaction = createMockInteraction('monster_select:zone1:skeleton');
    const startTime = Date.now();
    
    await handleButton(interaction, { prisma, client });
    
    const elapsed = Date.now() - startTime;
    expect(interaction.deferred).toBe(true);
    expect(elapsed).toBeLessThan(3000);
  });
  
  // ... 모든 버튼 핸들러 테스트
});
```

---

#### C. Prisma Client 동기화 체크
**파일:** `scripts/check-schema-sync.js`
```javascript
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkSchemaSync() {
  const schemaContent = fs.readFileSync('./prisma/schema.prisma', 'utf-8');
  
  // CombatSession 필드 체크
  const hasMonsterImageUrl = schemaContent.includes('monsterImageUrl');
  
  try {
    // 실제 DB 쿼리로 확인
    await prisma.combatSession.findFirst({
      select: { monsterImageUrl: true }
    });
    console.log('✅ Schema sync OK: monsterImageUrl exists');
  } catch (error) {
    if (error.message.includes('Unknown argument')) {
      console.error('❌ Schema out of sync! Run: npx prisma generate && restart bot');
      process.exit(1);
    }
  }
}

checkSchemaSync().then(() => process.exit(0));
```

**실행:** CI/CD 파이프라인에 추가
```bash
npm run check-schema-sync || exit 1
npm start
```

---

### 3. 장기 조치 (Long-term, 1주)

#### A. TypeScript 마이그레이션
- Schema 변경 시 컴파일 타임에 에러 감지
- `@prisma/client` 타입 자동 생성

#### B. E2E 테스트 자동화
- Playwright / Puppeteer로 실제 Discord UI 테스트
- 모든 버튼 클릭 시뮬레이션

#### C. 모니터링 시스템
- Sentry / Datadog로 에러 추적
- 알림 시스템 (Discord webhook)

---

## 📝 체크리스트

### 즉시 (오늘)
- [ ] 모든 버튼 핸들러에 deferUpdate 추가
- [ ] 전역 에러 핸들러 추가
- [ ] Schema 동기화 체크 스크립트 작성

### 단기 (1-2일)
- [ ] safeButtonHandler 유틸 작성 + 적용
- [ ] 통합 테스트 작성 (주요 버튼 10개)
- [ ] CI/CD에 schema-sync 체크 추가

### 장기 (1주)
- [ ] TypeScript 마이그레이션 검토
- [ ] E2E 테스트 프레임워크 선정
- [ ] 모니터링 시스템 구축

---

## 🎯 성공 지표

**목표:** 버그 발생률 90% 감소

**측정:**
- 주간 버그 리포트 수
- Discord timeout 에러 수
- 봇 크래시 빈도

**현재 (2026-02-24):** 3건 / 1시간
**목표 (1주 후):** 0건 / 1일

---

## 📚 참고 자료

- [Discord.js Guide - Handling Interactions](https://discordjs.guide/interactions/buttons.html)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Error Handling Patterns](https://nodejs.org/en/docs/guides/error-handling/)
