# 🧪 7 Tier 시스템 테스트 가이드

## 테스트 환경 설정

### 1. Stripe Test Mode 활성화
```
1. https://dashboard.stripe.com 로그인
2. 우측 상단 "Test mode" 토글 ON
3. Products → "+ Add product" 클릭
```

### 2. Test Products 생성
각 Tier별로 Product 생성 (총 7개):

#### Bronze ($4.99/월)
```
Name: Homeland Premium - Bronze (Test)
Price: $4.99 USD
Billing: Monthly recurring
Price ID: price_xxxxx → .env에 복사
```

#### Silver ($9.99/월)
```
Name: Homeland Premium - Silver (Test)
Price: $9.99 USD
Billing: Monthly recurring
Price ID: price_xxxxx → .env에 복사
```

#### Gold ($19.99/월)
```
Name: Homeland Premium - Gold (Test)
Price: $19.99 USD
Billing: Monthly recurring
Price ID: price_xxxxx → .env에 복사
```

#### Diamond ($34.99/월)
```
Name: Homeland Premium - Diamond (Test)
Price: $34.99 USD
Billing: Monthly recurring
Price ID: price_xxxxx → .env에 복사
```

#### Elite ($49.99/월)
```
Name: Homeland Premium - Elite (Test)
Price: $49.99 USD
Billing: Monthly recurring
Price ID: price_xxxxx → .env에 복사
```

#### Starter Pack ($2.99)
```
Name: Homeland - Starter Pack (Test)
Price: $2.99 USD
Billing: One time
Price ID: price_xxxxx → .env에 복사
```

#### Founder Pack ($99.99)
```
Name: Homeland - Founder Pack (Test)
Price: $99.99 USD
Billing: One time
Price ID: price_xxxxx → .env에 복사
```

### 3. .env 업데이트
```env
STRIPE_SECRET_KEY=sk_test_xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...

STRIPE_PRICE_BRONZE_MONTHLY=price_[bronze_test_id]
STRIPE_PRICE_SILVER_MONTHLY=price_[silver_test_id]
STRIPE_PRICE_GOLD_MONTHLY=price_[gold_test_id]
STRIPE_PRICE_DIAMOND_MONTHLY=price_[diamond_test_id]
STRIPE_PRICE_ELITE_MONTHLY=price_[elite_test_id]
STRIPE_PRICE_STARTER_PACK=price_[starter_test_id]
STRIPE_PRICE_FOUNDER_PACK=price_[founder_test_id]
```

### 4. Prisma Migration 실행
```bash
cd /Users/sang-junlee/homeland-discord-bot

# DB 백업 (프로덕션이면 필수!)
pg_dump $DATABASE_URL > backup_before_migration.sql

# Migration 실행
npx prisma migrate dev --name add_7tier_premium_system

# Prisma Client 재생성
npx prisma generate
```

### 5. 봇 재시작
```bash
npm run dev
```

---

## 테스트 시나리오

### 테스트 1: Premium Info 명령어
```
Discord에서:
/premium-info

기대 결과:
✅ 7개 Tier가 모두 표시됨
✅ Page 1: Starter, Bronze, Silver, Gold
✅ Page 2: Diamond, Elite, Founder
✅ "다음" / "이전" 버튼 작동
✅ "구독하기" 버튼 클릭 시 /premium-subscribe로 이동
```

### 테스트 2: Premium Subscribe UI
```
Discord에서:
/premium-subscribe

기대 결과:
✅ Select Menu에 7개 옵션 표시
✅ Starter Pack - $2.99 (일회성)
✅ Bronze - $4.99 (월간)
✅ Silver - $9.99 (월간)
✅ Gold - $19.99 (월간)
✅ Diamond - $34.99 (월간)
✅ Elite - $49.99 (월간)
✅ Founder Pack - $99.99 (평생)
```

### 테스트 3: Bronze Tier 구독
```
1. /premium-subscribe
2. Select Menu에서 "Bronze" 선택
3. "결제하기" 버튼 클릭
4. Stripe Checkout 페이지 열림
5. 테스트 카드 입력:
   Card: 4242 4242 4242 4242
   Expiry: 12/34
   CVC: 123
6. 결제 완료

기대 결과:
✅ Stripe Webhook 수신 (Railway 로그 확인)
✅ PremiumSubscription 레코드 생성 (tier: bronze)
✅ PremiumHistory 레코드 생성
✅ /premium 명령어로 활성화 확인
✅ /profile에 Premium 배지 표시
```

### 테스트 4: Starter Pack 일회성 결제
```
1. /premium-subscribe
2. "Starter Pack" 선택
3. 결제 완료

기대 결과:
✅ 골드 +1,000 즉시 지급
✅ 젬 +50 즉시 지급
✅ PremiumHistory에 type: 'one_time' 기록
✅ expiresAt: 48시간 후
✅ 48시간 후 자동 만료
```

### 테스트 5: Diamond Tier 구독
```
1. /premium-subscribe
2. "Diamond" 선택 ($34.99/월)
3. 결제 완료

기대 결과:
✅ PremiumSubscription tier: diamond
✅ 매일 젬 100개 (자정 크론으로 지급)
✅ XP +100% 적용 확인 (전투 후)
✅ Gold +75% 적용 확인
```

### 테스트 6: Founder Pack 평생 구독
```
1. /premium-subscribe
2. "Founder Pack" 선택 ($99.99)
3. 결제 완료

기대 결과:
✅ PremiumHistory type: 'one_time'
✅ expiresAt: 2099-12-31 (평생)
✅ PremiumSubscription tier: founder
✅ Elite와 동일한 혜택
✅ 독점 "Founder" 칭호 부여 (TODO: 구현 필요)
```

### 테스트 7: 구독 업그레이드
```
1. Bronze 구독 중인 유저
2. /premium-subscribe
3. "Diamond" 선택
4. 결제 완료

기대 결과:
✅ 기존 Bronze 구독 취소
✅ Diamond 구독 활성화
✅ PremiumHistory에 두 기록 모두 존재
```

### 테스트 8: 구독 취소
```
1. Stripe Dashboard → Customers
2. 테스트 유저의 구독 찾기
3. "Cancel subscription" 클릭
4. Webhook 수신 확인

기대 결과:
✅ customer.subscription.deleted 이벤트 수신
✅ PremiumSubscription 삭제
✅ 현재 기간 종료까지 혜택 유지
✅ 만료 후 Premium 배지 사라짐
```

### 테스트 9: 결제 실패
```
1. Stripe Test Card (결제 실패 카드 사용)
   Card: 4000 0000 0000 0341
2. 결제 시도

기대 결과:
✅ invoice.payment_failed 이벤트 수신
✅ PaymentHistory에 status: 'failed' 기록
✅ 유저에게 결제 실패 알림 (TODO: DM 발송)
```

---

## DB 검증 쿼리

### PremiumSubscription 확인
```sql
SELECT 
  userId, 
  tier, 
  planId, 
  startDate, 
  endDate, 
  autoFight 
FROM PremiumSubscription 
WHERE userId = 'YOUR_DISCORD_USER_ID';
```

### PremiumHistory 확인
```sql
SELECT 
  userId, 
  tier, 
  amount, 
  type, 
  purchasedAt, 
  expiresAt 
FROM PremiumHistory 
WHERE userId = 'YOUR_DISCORD_USER_ID' 
ORDER BY purchasedAt DESC;
```

### PaymentHistory 확인
```sql
SELECT 
  stripeInvoiceId, 
  amount, 
  currency, 
  status, 
  paidAt 
FROM PaymentHistory 
ORDER BY createdAt DESC 
LIMIT 10;
```

---

## Stripe Webhook 로컬 테스트

### Stripe CLI 설치
```bash
brew install stripe/stripe-cli/stripe
# 또는
npm install -g stripe-cli
```

### Webhook 로컬 포워딩
```bash
stripe login

# Webhook을 localhost:3000으로 포워딩
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 출력된 webhook secret을 .env에 추가
# STRIPE_WEBHOOK_SECRET=whsec_xxxxx...
```

### 테스트 이벤트 트리거
```bash
# Checkout 완료 시뮬레이션
stripe trigger checkout.session.completed

# 구독 생성 시뮬레이션
stripe trigger customer.subscription.created

# 결제 성공 시뮬레이션
stripe trigger invoice.payment_succeeded

# 결제 실패 시뮬레이션
stripe trigger invoice.payment_failed
```

---

## 로그 확인

### Railway 로그 확인
```
Railway Dashboard → Deployments → View Logs

검색 키워드:
[Stripe] Checkout completed
[Stripe] Tier detected: diamond
[Stripe] Premium history recorded
[Stripe] Premium diamond activated
```

### 로컬 로그 확인
```bash
npm run dev

# 로그 출력:
[Stripe] Webhook received: checkout.session.completed
[Stripe] Checkout completed for user 123456789
[Stripe] Tier detected: bronze
[Stripe] Premium history recorded for bronze
[Stripe] Premium bronze activated for TestUser until 2026-03-25
```

---

## 문제 해결

### 문제 1: Webhook이 수신되지 않음
**원인**: Railway URL이 잘못됨
**해결**:
```bash
1. Railway Dashboard → Settings → 실제 URL 확인
2. Stripe Dashboard → Webhooks → Endpoint URL 업데이트
3. Webhook Secret 재생성 후 .env 업데이트
```

### 문제 2: Tier가 null로 저장됨
**원인**: Price ID 매핑 실패
**해결**:
```bash
1. .env에 Price ID가 올바른지 확인
2. Stripe Dashboard → Products → Price ID 재확인
3. getTierFromPriceId() 함수 로그 확인
```

### 문제 3: Prisma Migration 실패
**원인**: enum 추가 시 기존 데이터 충돌
**해결**:
```bash
# 기존 PremiumSubscription의 tier를 null로 설정
UPDATE PremiumSubscription SET tier = NULL WHERE tier IS NOT NULL;

# Migration 재실행
npx prisma migrate dev
```

### 문제 4: Starter Pack 보너스 미지급
**원인**: Webhook에서 Starter Pack 처리 누락
**해결**:
```javascript
// src/routes/stripe-webhook.js
// handleCheckoutCompleted 함수 확인
if (tier === 'starter') {
  await prisma.character.update({
    where: { id: character.id },
    data: {
      gold: { increment: 1000 },
      gems: { increment: 50 },
    }
  });
}
```

---

## 성공 기준

✅ 모든 7개 Tier 결제 테스트 통과  
✅ Webhook 이벤트 100% 수신  
✅ PremiumHistory 정확히 기록  
✅ Premium 혜택 정상 적용  
✅ 구독 업그레이드/취소 정상 작동  
✅ 일회성 결제 (Starter/Founder) 정상 작동  

---

## 다음 단계

테스트 완료 후:
1. ✅ Test Mode 검증 완료
2. → Live Mode 전환
3. → 베타 유저 초대 (10-20명)
4. → 피드백 수집
5. → 프로덕션 배포
6. → 마케팅 시작

---

**테스트 완료 체크리스트**

- [ ] Premium Info 명령어 작동
- [ ] Premium Subscribe UI 표시
- [ ] Bronze/Silver/Gold 결제 테스트
- [ ] Diamond Tier 결제 테스트
- [ ] Elite Tier 결제 테스트
- [ ] Starter Pack 일회성 결제 + 보너스 지급
- [ ] Founder Pack 평생 구독
- [ ] 구독 업그레이드
- [ ] 구독 취소
- [ ] Webhook 이벤트 100% 수신
- [ ] DB 레코드 정확히 생성
- [ ] Premium 혜택 적용 확인

**모든 테스트 통과 시 → 제리에게 보고 + Railway 배포 준비** ✅

Good luck! 🧪🚀
