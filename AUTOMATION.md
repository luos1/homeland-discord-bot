# 🤖 HOMELAND 개발 자동화 가이드

> 수동 작업을 최소화하고 개발 품질을 자동으로 유지합니다.

---

## 📋 목차

1. [CI/CD 파이프라인](#cicd-파이프라인)
2. [코드 품질 자동 검증](#코드-품질-자동-검증)
3. [배포 자동화](#배포-자동화)
4. [이슈 자동 관리](#이슈-자동-관리)
5. [버그 추적 자동화](#버그-추적-자동화)
6. [모니터링 자동화](#모니터링-자동화)
7. [설정 방법](#설정-방법)

---

## 🚀 CI/CD 파이프라인

### 자동화된 작업

#### 1. **코드 Push 시 자동 검증** (`.github/workflows/ci.yml`)
- ✅ ESLint로 코드 스타일 검증
- ✅ Node.js 문법 체크
- ✅ 자동 테스트 실행 (있을 경우)
- ❌ 실패 시 Discord 알림

**트리거:** `main`, `develop` 브랜치에 push 또는 PR

**예상 시간:** ~2분

---

#### 2. **배포 알림** (`.github/workflows/deploy-notify.yml`)
- 🚀 배포 시작 알림 (Discord)
- ⏳ Railway 배포 대기 (5분)
- ✅ 배포 완료 알림 (Discord)

**트리거:** `main` 브랜치에 push

**예상 시간:** ~5분

---

#### 3. **PR/Issue 자동 라벨링** (`.github/workflows/auto-label.yml`)
- 🏷️ `bug` 키워드 → `bug`, `needs-triage` 라벨
- 🏷️ `feature` 키워드 → `enhancement`, `needs-review` 라벨
- 🏷️ `Zone` 관련 PR → `content`, `zone-expansion` 라벨

**트리거:** 새 Issue/PR 생성

---

#### 4. **자동 릴리즈 노트** (`.github/workflows/release.yml`)
- 📝 커밋 메시지 자동 수집
- 📦 GitHub Release 자동 생성
- 🎉 Discord 공지

**트리거:** `v*` 태그 push (예: `v1.0.0`)

**사용법:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 🔍 코드 품질 자동 검증

### ESLint 설정 (`.eslintrc.js`)

**자동 검증 항목:**
- ❌ 미사용 변수
- ❌ `var` 사용 (const/let 강제)
- ❌ `==` 사용 (=== 강제)
- ⚠️ 세미콜론 누락
- ⚠️ 인덴트 불일치

**로컬 실행:**
```bash
npm run lint          # 검증만
npm run lint:fix      # 자동 수정
```

**CI 자동 실행:** 매 push마다 자동

---

## 📦 배포 자동화

### 현재 자동화 상태

#### ✅ 자동 배포 (Railway)
```bash
git add -A
git commit -m "your message"
git push origin main
# → Railway가 자동으로 배포 시작
# → 5분 후 gameMaster 봇 재시작
```

#### 📢 자동 알림 (Discord)
- 배포 시작 알림
- 배포 완료 알림
- 배포 실패 알림

---

## 🐛 이슈 자동 관리

### GitHub Issues 템플릿

**버그 리포트 템플릿** (`.github/ISSUE_TEMPLATE/bug_report.md`)
```markdown
## 🐛 버그 설명
(간단한 설명)

## 📋 재현 방법
1. ...
2. ...

## 💡 예상 동작
(어떻게 작동해야 하는지)

## 📸 스크린샷
(가능하면 첨부)
```

**기능 요청 템플릿** (`.github/ISSUE_TEMPLATE/feature_request.md`)
```markdown
## 💡 기능 설명
(구현하고 싶은 기능)

## 🎯 목적
(왜 필요한지)

## 📝 구현 아이디어
(어떻게 구현할지)
```

---

## 📊 버그 추적 자동화

### Sentry 연동 (선택)

**설치:**
```bash
npm install @sentry/node
```

**설정 (src/bot.js):**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

// 에러 캡처
client.on('error', (error) => {
  Sentry.captureException(error);
  console.error('Discord client error:', error);
});
```

**자동화 효과:**
- 모든 에러 자동 수집
- Discord webhook으로 알림
- 에러 빈도/심각도 분석
- 스택 트레이스 자동 기록

---

## 📈 모니터링 자동화

### 1. Railway 기본 모니터링
- ✅ CPU 사용률
- ✅ 메모리 사용률
- ✅ 응답 시간
- ✅ 재시작 횟수

**확인:** Railway Dashboard

---

### 2. 커스텀 로깅 (선택)

**Discord Webhook으로 중요 이벤트 자동 알림:**

```javascript
// src/utils/webhook.js
const axios = require('axios');

async function sendWebhook(title, description, color = 0x00ff00) {
  if (!process.env.DISCORD_WEBHOOK) return;
  
  await axios.post(process.env.DISCORD_WEBHOOK, {
    embeds: [{
      title,
      description,
      color,
      timestamp: new Date().toISOString(),
    }],
  });
}

// 사용 예시
sendWebhook('🐛 Bug Detected', `Error: ${error.message}`, 0xff0000);
sendWebhook('🎉 Level 50 Reached', `User: ${username}`, 0xffd700);
```

---

## ⚙️ 설정 방법

### 1. GitHub Secrets 설정

**필수:**
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. New repository secret 클릭
3. 다음 시크릿 추가:

| Name | Value | 설명 |
|------|-------|------|
| `DISCORD_WEBHOOK` | `https://discord.com/api/webhooks/...` | 알림받을 Discord 채널 Webhook |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Sentry 프로젝트 DSN (선택) |

---

### 2. Discord Webhook 생성

1. Discord 서버 → 채널 설정 → 연동 → Webhook
2. "새 Webhook 만들기" 클릭
3. 이름: "HOMELAND Bot Notifications"
4. Webhook URL 복사
5. GitHub Secrets에 `DISCORD_WEBHOOK`로 저장

---

### 3. ESLint 설치

```bash
cd homeland-discord-bot
npm install --save-dev eslint
```

---

### 4. Git Hooks 설정 (선택)

**Husky 설치 (커밋 전 자동 검증):**
```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run validate"
```

**효과:** `git commit` 시 자동으로 ESLint + 문법 체크

---

## 🎯 자동화 체크리스트

### ✅ 즉시 사용 가능
- [x] CI/CD 파이프라인 (GitHub Actions)
- [x] 코드 품질 검증 (ESLint)
- [x] 배포 알림 (Discord)
- [x] PR/Issue 자동 라벨링
- [x] 릴리즈 노트 자동 생성

### 🔧 설정 필요
- [ ] Discord Webhook 생성 및 시크릿 등록
- [ ] ESLint 의존성 설치 (`npm install`)
- [ ] Sentry 계정 생성 (선택)
- [ ] Husky pre-commit 훅 설정 (선택)

### 📅 향후 추가 계획
- [ ] 자동 테스트 (Jest)
- [ ] 성능 벤치마크 자동화
- [ ] DB 마이그레이션 자동 검증
- [ ] 보안 취약점 자동 스캔 (Dependabot)

---

## 🚀 사용 예시

### 일반적인 개발 워크플로우

```bash
# 1. 코드 작성
vim src/commands/new_feature.js

# 2. 로컬 검증
npm run lint          # 코드 스타일 체크
npm run check         # 문법 체크

# 3. 커밋 & 푸시
git add -A
git commit -m "Add new feature"
git push origin main

# → GitHub Actions 자동 실행:
#   - ESLint 검증
#   - 문법 체크
#   - Discord 배포 시작 알림
#   - Railway 자동 배포
#   - Discord 배포 완료 알림
```

---

### 릴리즈 워크플로우

```bash
# 1. 버전 태그 생성
git tag v1.1.0

# 2. 태그 푸시
git push origin v1.1.0

# → GitHub Actions 자동 실행:
#   - 커밋 메시지 수집
#   - GitHub Release 생성
#   - Discord 릴리즈 공지
```

---

## 📊 모니터링 대시보드

### GitHub Actions
- 경로: `https://github.com/luos1/homeland-discord-bot/actions`
- 모든 워크플로우 실행 이력 확인
- 실패 시 로그 확인

### Railway
- 경로: `https://railway.app/project/...`
- 실시간 로그 스트리밍
- 리소스 사용량 모니터링

### Sentry (선택)
- 경로: `https://sentry.io/...`
- 에러 발생 빈도 대시보드
- 스택 트레이스 분석

---

## 🔔 알림 예시

### Discord 알림 메시지

**배포 시작:**
```
🚀 Deployment Started

Commit: Add Zone 4 monsters
Author: luos
Railway: Auto-deploying to production...
```

**배포 완료:**
```
✅ Deployment Complete

gameMaster bot is now live with latest changes!

Recent updates:
- Add Zone 4 monsters
```

**CI 실패:**
```
❌ CI Failed

Code quality check failed on main

Error: ESLint found 3 warnings
```

---

## 🎓 추가 학습 자료

- [GitHub Actions 문서](https://docs.github.com/actions)
- [ESLint 공식 가이드](https://eslint.org/docs/user-guide/getting-started)
- [Sentry Node.js 가이드](https://docs.sentry.io/platforms/node/)
- [Railway 문서](https://docs.railway.app/)

---

**마지막 업데이트:** 2025-02-22  
**다음 리뷰:** 자동화 활성화 후
