# Homeland Discord Bot - 배포 가이드

## Railway 배포 (자동)

### 1. GitHub 연동
1. [Railway.app](https://railway.app) 가입
2. "New Project" → "Deploy from GitHub repo"
3. `homeland-discord-bot` 저장소 선택
4. Railway가 자동으로 빌드 & 배포

### 2. 환경 변수 설정
Railway 대시보드에서 Variables 탭:

```bash
# 필수
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
DATABASE_URL=postgresql://... # Railway가 자동 생성

# 선택 (프리미엄 기능)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BRONZE_MONTHLY=price_...
STRIPE_PRICE_SILVER_MONTHLY=price_...
STRIPE_PRICE_GOLD_MONTHLY=price_...
BASE_URL=https://homeland-bot.com
```

### 3. 데이터베이스
Railway PostgreSQL 플러그인이 자동으로 생성됩니다.

Prisma 마이그레이션은 배포 시 자동 실행:
```bash
# Railway build command (package.json)
"build": "prisma generate && prisma migrate deploy"
```

### 4. 배포 확인
- Railway 대시보드에서 로그 확인
- Discord에서 `/play` 명령어 테스트
- 오류 시 Logs 탭 확인

---

## 수동 배포 (VPS/로컬)

### 1. 사전 준비
```bash
# Node.js v18+ 필수
node --version

# PostgreSQL 설치
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt-get install postgresql
sudo systemctl start postgresql
```

### 2. 저장소 클론
```bash
git clone https://github.com/yourusername/homeland-discord-bot.git
cd homeland-discord-bot
```

### 3. 환경 변수 설정
```bash
cp .env.example .env
nano .env
```

`.env` 파일 편집:
```bash
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
DATABASE_URL=postgresql://user:password@localhost:5432/homeland
```

### 4. 의존성 설치 & 마이그레이션
```bash
npm install
npx prisma migrate deploy
npx prisma generate
```

### 5. 봇 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

### 6. PM2로 백그라운드 실행 (권장)
```bash
npm install -g pm2
pm2 start src/bot.js --name homeland-bot
pm2 startup  # 부팅 시 자동 시작
pm2 save
```

---

## Stripe Webhook 설정 (프리미엄 기능)

### 1. Stripe CLI 설치
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/vX.X.X/stripe_X.X.X_linux_x86_64.tar.gz
tar -xvf stripe_X.X.X_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### 2. Webhook 엔드포인트 설정
```bash
# 로컬 테스트
stripe listen --forward-to localhost:3000/webhook/stripe

# 프로덕션 (Stripe 대시보드)
# 1. https://dashboard.stripe.com/webhooks
# 2. "Add endpoint"
# 3. URL: https://yourdomain.com/webhook/stripe
# 4. Events: checkout.session.completed, customer.subscription.*
```

### 3. Webhook Secret 설정
```bash
# .env에 추가
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Discord Bot 설정

### 1. Discord Developer Portal
1. [Discord Developer Portal](https://discord.com/developers/applications)
2. "New Application" → 봇 이름 입력
3. "Bot" 탭 → "Add Bot"
4. "Reset Token" → 토큰 복사 (`.env`에 저장)

### 2. Bot Permissions
Privileged Gateway Intents:
- ✅ Presence Intent
- ✅ Server Members Intent
- ✅ Message Content Intent

OAuth2 Scopes:
- ✅ bot
- ✅ applications.commands

Bot Permissions:
- ✅ Send Messages
- ✅ Send Messages in Threads
- ✅ Embed Links
- ✅ Attach Files
- ✅ Use Slash Commands
- ✅ Manage Messages (선택)

### 3. Bot 초대
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274878286912&scope=bot%20applications.commands
```

---

## 데이터베이스 마이그레이션

### 새 마이그레이션 생성
```bash
npx prisma migrate dev --name add_new_feature
```

### 프로덕션 마이그레이션
```bash
npx prisma migrate deploy
```

### 데이터베이스 초기화 (주의!)
```bash
npx prisma migrate reset
```

---

## 모니터링 & 로그

### Railway 로그
Railway 대시보드 → Logs 탭

### PM2 로그
```bash
pm2 logs homeland-bot
pm2 monit
```

### 에러 추적
```bash
# 최근 100줄 로그
pm2 logs --lines 100

# 실시간 로그
pm2 logs --raw
```

---

## 트러블슈팅

### 봇이 시작되지 않음
```bash
# 환경 변수 확인
echo $DISCORD_TOKEN

# 데이터베이스 연결 확인
npx prisma db push

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### Slash 명령어가 등록되지 않음
```bash
# 명령어 강제 재등록
node src/deploy-commands.js
```

### 데이터베이스 연결 오류
```bash
# PostgreSQL 실행 확인
# macOS
brew services list

# Linux
sudo systemctl status postgresql

# 연결 테스트
psql -h localhost -U postgres -d homeland
```

---

## 백업 & 복구

### 데이터베이스 백업
```bash
# 백업
pg_dump -h localhost -U postgres homeland > backup.sql

# 복구
psql -h localhost -U postgres homeland < backup.sql
```

### 자동 백업 (Cron)
```bash
# crontab -e
0 2 * * * pg_dump -h localhost -U postgres homeland > /backups/homeland_$(date +\%Y\%m\%d).sql
```

---

## 보안 권장 사항

1. **환경 변수 보호**
   - `.env` 파일 절대 공개 금지
   - `.gitignore`에 `.env` 포함 확인

2. **토큰 관리**
   - Discord Bot Token 주기적 갱신
   - Stripe 키는 Live 키 사용 (프로덕션)

3. **데이터베이스**
   - 강력한 비밀번호 사용
   - 외부 접근 제한 (방화벽)

4. **Webhook**
   - Stripe Webhook Secret 검증 활성화
   - HTTPS만 사용

---

## 성능 최적화

### 데이터베이스 인덱스
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX idx_character_userId ON Character(userId);
CREATE INDEX idx_combatSession_userId ON CombatSession(userId);
```

### 캐싱
```javascript
// Redis 캐싱 (선택)
const redis = require('redis');
const client = redis.createClient();

// 유저 데이터 캐싱 (5분)
await client.setEx(`user:${userId}`, 300, JSON.stringify(character));
```

### 연결 풀링
```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connectionLimit = 10
}
```

---

**배포 완료 후 체크리스트:**
- [ ] 봇이 온라인 상태
- [ ] `/play` 명령어 작동
- [ ] 전투 시스템 작동
- [ ] 데이터베이스 저장 확인
- [ ] 에러 로그 없음
