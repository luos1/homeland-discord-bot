# 🚀 Phase 1: 7 Tier 수익 구조 구현 완료

**작성일**: 2026-02-25  
**목표**: 기존 3 Tier → 7 Tier + 일회성 상품 확장  
**상태**: ✅ 개발 완료, 테스트 대기  

---

## 📋 구현 완료 항목

### ✅ 1. DB 스키마 업데이트

#### 추가된 Enum & Models
```prisma
enum PremiumTier {
  bronze
  silver
  gold
  diamond    // 신규
  elite      // 신규
  founder    // 신규
  starter    // 신규
}

model PremiumHistory {
  // 결제 히스토리 추적
  userId, tier, amount, type, purchasedAt, expiresAt
  stripeInvoiceId, stripeSubscriptionId, stripePriceId
}

model Coupon {
  // 할인 쿠폰 시스템
  code, discountPercent, discountAmount
  maxUses, usageCount, expiresAt, active
}
```

#### 업데이트된 Models
```prisma
model PremiumSubscription {
  // tier 필드 추가 (PremiumTier enum)
  tier PremiumTier?
  
  // 기존 필드 유지
  userId, planId, startDate, endDate
  autoFight, autoPotion, autoConsumable
}
```

**파일**: `prisma/schema.prisma`

---

### ✅ 2. Premium Tiers 정의 (7단계)

#### 일회성 상품
- **📱 Starter Pack** - $2.99
  - 48시간 부스트 (XP +100%, Gold +50%)
  - 골드 1,000개 즉시 지급
  - 젬 50개 즉시 지급
  - 레어 무기 상자 x1

#### 기존 구독 (업데이트)
- **🥉 Bronze** - $4.99/월 (기존 $5 → $4.99)
  - XP +20%, Gold +15%
  - 오토 배틀 10회/일
  - 매일 젬 10개

- **🥈 Silver** - $9.99/월 (기존 $10 → $9.99)
  - XP +40%, Gold +30%
  - 오토 배틀 30회/일
  - 매일 젬 25개

- **🥇 Gold** - $19.99/월 (기존 $20 → $19.99)
  - XP +60%, Gold +50%
  - 오토 배틀 무제한
  - 매일 젬 50개

#### 신규 프리미엄 구독
- **💎 Diamond** - $34.99/월
  - XP +100%, Gold +75%
  - 매일 젬 100개
  - 전용 스킨 3개/월
  - 커스텀 칭호 제작

- **👑 Elite** - $49.99/월
  - XP +150%, Gold +100%
  - 매일 젬 200개
  - 전용 스킨 5개/월
  - 독점 레전더리 펫
  - 개발자 Q&A 참여

#### 한정 상품
- **🔥 Founder Pack** - $99.99 (평생)
  - 평생 Elite 혜택
  - 독점 "Founder" 칭호
  - 게임 크레딧 이름 등재
  - 로드맵 투표권
  - 선착순 100명 한정

**파일**: `src/game/premium-tiers.js`

---

### ✅ 3. 봇 명령어 구현

#### `/premium-subscribe` (신규)
- 7 Tier 선택 UI (Select Menu)
- Tier별 상세 혜택 표시
- 결제 확인 페이지
- Stripe Checkout 연동

#### `/premium-info` (신규)
- 모든 Tier 비교 테이블 (2페이지)
- 페이지 네비게이션
- 특별 혜택 안내
- "구독하기" 버튼

#### `/premium` (기존 유지)
- Premium 상태 확인
- 자동 전투 설정 토글
- 구독 만료일 표시

**파일**: 
- `src/commands/premium-subscribe.js`
- `src/commands/premium-info.js`
- `src/commands/premium.js` (기존)

---

### ✅ 4. Stripe Webhook 처리 업데이트

#### 지원하는 이벤트
- `checkout.session.completed` - 결제 완료
- `customer.subscription.created` - 구독 생성
- `customer.subscription.updated` - 구독 업데이트
- `customer.subscription.deleted` - 구독 취소
- `invoice.payment_succeeded` - 결제 성공
- `invoice.payment_failed` - 결제 실패

#### 새로운 기능
- Price ID → Tier 자동 매핑
- PremiumHistory에 결제 히스토리 기록
- 일회성 결제 처리 (Starter Pack, Founder Pack)
- Starter Pack 보너스 자동 지급 (골드 +1000, 젬 +50)
- Lifetime 구독 처리 (Founder Pack)

**파일**: `src/routes/stripe-webhook.js`

---

### ✅ 5. 환경 변수 설정

`.env.example` 업데이트:
```env
# Stripe Price IDs - Subscriptions
STRIPE_PRICE_BRONZE_MONTHLY=price_...
STRIPE_PRICE_SILVER_MONTHLY=price_...
STRIPE_PRICE_GOLD_MONTHLY=price_...
STRIPE_PRICE_DIAMOND_MONTHLY=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...

# Stripe Price IDs - One-time
STRIPE_PRICE_STARTER_PACK=price_...
STRIPE_PRICE_FOUNDER_PACK=price_...

# Stripe Coupons
STRIPE_COUPON_FIRST_SUBSCRIPTION_30=coupon_...
```

**파일**: `.env.example`

---

### ✅ 6. 문서화

#### Stripe 설정 가이드
- Products 생성 단계별 안내
- 7개 Tier Price ID 생성
- Coupon 생성 (30% 할인, 7일 체험)
- Webhook 설정
- Railway 환경변수 설정
- Test Mode 테스트 가이드
- Live Mode 전환 가이드

**파일**: `docs/STRIPE_7TIER_SETUP.md`

---

## 🧪 다음 단계: 테스트

### 1. Stripe Test Mode 설정
```bash
cd /Users/sang-junlee/homeland-discord-bot

# Stripe 대시보드에서:
# 1. Test Mode 활성화
# 2. 7개 Products 생성
# 3. Price IDs 복사
# 4. .env에 추가
```

### 2. Prisma Migration 실행
```bash
# DB 스키마 업데이트
npx prisma migrate dev --name add_7tier_system

# Prisma Client 재생성
npx prisma generate
```

### 3. 봇 재시작 & 테스트
```bash
# 로컬 테스트
npm run dev

# Discord에서 테스트
/premium-info              # Tier 비교 확인
/premium-subscribe         # 구독 UI 확인

# Stripe Test Card로 결제 테스트
# Card: 4242 4242 4242 4242
# Expiry: 12/34
# CVC: 123
```

### 4. Webhook 테스트
```bash
# Stripe CLI로 로컬 webhook 테스트
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 테스트 이벤트 트리거
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
```

### 5. 검증 체크리스트
- [ ] `/premium-info` 명령어로 7 Tier 표시 확인
- [ ] `/premium-subscribe` Select Menu에 7개 옵션 표시
- [ ] Bronze/Silver/Gold Tier 결제 테스트
- [ ] Diamond Tier 결제 테스트
- [ ] Elite Tier 결제 테스트
- [ ] Starter Pack 일회성 결제 테스트 (골드 +1000, 젬 +50 확인)
- [ ] Founder Pack 결제 테스트
- [ ] 7일 무료 체험 적용 확인
- [ ] 30% 할인 쿠폰 적용 확인
- [ ] Webhook 이벤트 수신 확인 (Railway 로그)
- [ ] PremiumHistory 테이블에 기록 확인
- [ ] PremiumSubscription tier 필드 업데이트 확인

---

## 📊 예상 수익 시뮬레이션

### 현재 (3 Tier)
- 유저 1,000명
- 전환율 5%
- 평균 $10/월
- **수익: ~$500/월**

### Phase 1 완료 후 (7 Tier)
- 유저 1,000명
- 구독 전환율 12% (120명)
  - Bronze: 50명 x $4.99 = $249.50
  - Silver: 40명 x $9.99 = $399.60
  - Gold: 20명 x $19.99 = $399.80
  - Diamond: 7명 x $34.99 = $244.93
  - Elite: 3명 x $49.99 = $149.97
- 일회성 구매: 20% (200명) x $15 평균 = $3,000 (일회성)
- **월 구독 수익: ~$1,444/월**
- **일회성 수익: ~$3,000 (첫 달)**

### 6개월 후 목표 (유저 5,000명)
- 구독 수익: ~$7,220/월
- 일회성 수익: ~$15,000
- **목표 달성: $10,000/월** ✅

---

## 🚨 주의사항

### Founder Pack 한정 판매
- Stripe Metadata로 판매 수량 추적 필요
- 100개 판매 완료 시 Product 비활성화
- "SOLD OUT" 표시 추가

### Migration 백업
```bash
# 프로덕션 DB 백업 필수!
pg_dump $DATABASE_URL > backup_before_7tier.sql
```

### Rollback 계획
- 기존 Bronze/Silver/Gold는 그대로 유지
- 신규 Tier 추가만이므로 롤백 위험 낮음
- 최악의 경우 신규 Tier Products만 비활성화

---

## 📝 TODO (Phase 2)

Phase 1 완료 후 추가 작업:
- [ ] Gem Packs 구현 (일회성 젬 구매)
- [ ] Special Bundles (패키지 상품)
- [ ] 친구 추천 프로그램
- [ ] 시즌 패스 시스템
- [ ] Convenience Items (이름 변경, 리셋 등)
- [ ] 연간 구독 옵션
- [ ] Gift 기능 (선물하기)

---

## 🎯 완료 보고

**제리에게 보고 사항:**
✅ Phase 1 개발 완료  
✅ 7 Tier 시스템 구현  
✅ Stripe 연동 준비 완료  
✅ DB 스키마 업데이트 완료  
✅ Webhook 처리 구현  

**다음 액션:**
1. Stripe Test Mode에서 Products 생성
2. Prisma Migration 실행
3. 로컬 테스트
4. Railway 배포
5. 프로덕션 테스트
6. 베타 유저 피드백 수집

**예상 배포 일정:**
- 테스트: 2일
- 베타 배포: 1일
- 프로덕션 배포: 1일
- **총 4일 예상**

---

**작업 완료! 🎉**

Let's scale to $10K/month! 🚀💰
