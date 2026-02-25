# 🔧 Stripe 7 Tier 설정 가이드

## 목표
Homeland Premium 수익 구조를 3 Tier → 7 Tier로 확장하고 일회성 상품 추가

---

## 📋 작업 개요

### 신규 Tier
1. **Starter Pack** - $2.99 일회성
2. **Bronze** - $4.99/월 (기존 유지)
3. **Silver** - $9.99/월 (기존 유지)
4. **Gold** - $19.99/월 (기존 유지)
5. **Diamond** - $34.99/월 (신규)
6. **Elite** - $49.99/월 (신규)
7. **Founder Pack** - $99.99 평생 (신규, 한정)

---

## 🎯 Step 1: Stripe 대시보드에서 Products 생성

### 1.1 Stripe Dashboard 로그인
- https://dashboard.stripe.com
- Products → "+ Add product"

### 1.2 Bronze Tier (기존 유지)
```
Name: Homeland Premium - Bronze
Description: 기본 프리미엄 혜택
Price: $4.99 USD
Billing: Monthly recurring
```
**Price ID 복사**: `price_xxxxx...`

### 1.3 Silver Tier (기존 유지)
```
Name: Homeland Premium - Silver
Description: 강화된 프리미엄 혜택
Price: $9.99 USD
Billing: Monthly recurring
```
**Price ID 복사**: `price_xxxxx...`

### 1.4 Gold Tier (기존 유지)
```
Name: Homeland Premium - Gold
Description: 최고급 프리미엄 혜택
Price: $19.99 USD
Billing: Monthly recurring
```
**Price ID 복사**: `price_xxxxx...`

### 1.5 Diamond Tier ✨ 신규
```
Name: Homeland Premium - Diamond
Description: 엔드게임 유저를 위한 프리미엄 플랜
Price: $34.99 USD
Billing: Monthly recurring
```
**Price ID 복사**: `price_xxxxx...`

### 1.6 Elite Tier ✨ 신규
```
Name: Homeland Premium - Elite
Description: VIP 프리미엄 플랜
Price: $49.99 USD
Billing: Monthly recurring
```
**Price ID 복사**: `price_xxxxx...`

### 1.7 Starter Pack ✨ 신규 (일회성)
```
Name: Homeland - Starter Pack
Description: 첫 결제 유저를 위한 시작 패키지
Price: $2.99 USD
Billing: One time payment
Type: One-time
```
**Price ID 복사**: `price_xxxxx...`

### 1.8 Founder Pack ✨ 신규 (평생)
```
Name: Homeland - Founder Pack
Description: 평생 Elite 혜택 (선착순 100명)
Price: $99.99 USD
Billing: One time payment
Type: One-time
Metadata:
  - limited: true
  - max_quantity: 100
  - benefits: lifetime_elite
```
**Price ID 복사**: `price_xxxxx...`

---

## 🎁 Step 2: Coupon 생성

### 2.1 첫 구독 30% 할인
```
Stripe Dashboard → Coupons → "+ Create coupon"

Name: First Subscription 30% Off
Coupon ID: FIRST30
Discount: 30% off
Duration: Once
Applies to: Subscriptions only
```
**Coupon ID 복사**: `FIRST30`

### 2.2 7일 무료 체험
```
각 구독 Product 설정:
Products → [해당 상품] → Pricing → "Add free trial"

Trial period: 7 days
```

---

## 🔔 Step 3: Webhook 설정 업데이트

### 3.1 Webhook Events 추가
```
Stripe Dashboard → Developers → Webhooks
Endpoint URL: https://your-railway-app.railway.app/webhook/stripe

Events to send:
✅ checkout.session.completed
✅ customer.subscription.created
✅ customer.subscription.updated
✅ customer.subscription.deleted
✅ invoice.payment_succeeded
✅ invoice.payment_failed
✅ invoice.payment_action_required
✅ customer.subscription.trial_will_end (신규)
```

### 3.2 Webhook Secret 복사
```
Signing secret: whsec_xxxxx...
```

---

## ⚙️ Step 4: Railway 환경변수 설정

Railway Dashboard → Variables에 추가:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...

# Subscriptions
STRIPE_PRICE_BRONZE_MONTHLY=price_[bronze_id]
STRIPE_PRICE_SILVER_MONTHLY=price_[silver_id]
STRIPE_PRICE_GOLD_MONTHLY=price_[gold_id]
STRIPE_PRICE_DIAMOND_MONTHLY=price_[diamond_id]
STRIPE_PRICE_ELITE_MONTHLY=price_[elite_id]

# One-time Products
STRIPE_PRICE_STARTER_PACK=price_[starter_id]
STRIPE_PRICE_FOUNDER_PACK=price_[founder_id]

# Coupons
STRIPE_COUPON_FIRST_SUBSCRIPTION_30=FIRST30

# Base URL
BASE_URL=https://your-app.railway.app
```

**저장 후 자동 재배포됨**

---

## 🧪 Step 5: 테스트

### 5.1 Test Mode에서 테스트
```bash
# Stripe Dashboard에서 "Test mode" 활성화

# Discord에서 테스트:
/premium subscribe tier:diamond

# 테스트 카드 정보:
Card: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
ZIP: 12345
```

### 5.2 검증 체크리스트
- [ ] Bronze/Silver/Gold 기존 구독 정상 작동
- [ ] Diamond Tier 구독 성공
- [ ] Elite Tier 구독 성공
- [ ] Starter Pack 일회성 결제 성공
- [ ] Founder Pack 결제 성공
- [ ] 7일 무료 체험 적용 확인
- [ ] 30% 할인 쿠폰 적용 확인
- [ ] Webhook 이벤트 수신 확인
- [ ] Premium 혜택 적용 확인
- [ ] `/premium info` 명령어로 7 Tier 표시 확인

---

## 🚀 Step 6: Live Mode 전환

### 6.1 Live Mode로 전환
```
Stripe Dashboard → "Test mode" OFF
```

### 6.2 Live Products 생성
Step 1의 모든 Products를 Live Mode에서 다시 생성

### 6.3 Live Keys 교체
```env
STRIPE_SECRET_KEY=sk_live_xxxxx...  # Test → Live
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...  # Test → Live
STRIPE_PRICE_BRONZE_MONTHLY=price_[live_bronze_id]
STRIPE_PRICE_SILVER_MONTHLY=price_[live_silver_id]
STRIPE_PRICE_GOLD_MONTHLY=price_[live_gold_id]
STRIPE_PRICE_DIAMOND_MONTHLY=price_[live_diamond_id]
STRIPE_PRICE_ELITE_MONTHLY=price_[live_elite_id]
STRIPE_PRICE_STARTER_PACK=price_[live_starter_id]
STRIPE_PRICE_FOUNDER_PACK=price_[live_founder_id]
```

### 6.4 Founder Pack 수량 제한 모니터링
```javascript
// Stripe Dashboard → Products → Founder Pack
// Metadata에 판매 수량 추적
// sold_count: 0/100
```

---

## 📊 Step 7: 수익 모니터링

### Stripe Analytics
- Dashboard → Home: 총 수익, 구독자 수
- Dashboard → Billing → Subscriptions: 활성 구독 추이
- Dashboard → Products: Tier별 인기도

### 목표
- **현재**: ~$500/월 (3 Tier)
- **1개월 후**: $1,000/월
- **3개월 후**: $2,000/월
- **6개월 후**: $5,000/월

---

## ⚠️ 주의사항

### Founder Pack 한정 판매
- 선착순 100명으로 제한
- Metadata로 판매 수량 추적
- 100개 판매 완료 시 자동으로 비활성화
- "SOLD OUT" 표시로 FOMO 유도

### 환불 정책
- Starter Pack: 24시간 내 환불 가능
- 구독: 언제든지 취소 가능 (남은 기간 사용 가능)
- Founder Pack: 7일 내 환불 가능

### 가격 변경
- 기존 구독자는 기존 가격 유지 (grandfather clause)
- 신규 구독자만 새 가격 적용

---

## 📝 다음 단계

✅ Stripe 설정 완료  
→ 봇 코드 업데이트 (`/premium subscribe` 7 Tier UI)  
→ Premium 혜택 적용 로직 업데이트  
→ 베타 테스트 시작  
→ 마케팅 자료 준비  

---

**예상 소요 시간**: 2-3시간  
**난이도**: ⭐⭐⭐☆☆

Good luck! 🚀💰
