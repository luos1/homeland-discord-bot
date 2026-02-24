require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS 설정
app.use(cors({
  origin: [
    'https://luos1.github.io',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════════════
// 상품 정의
// ═══════════════════════════════════════════════════════════════
const PRODUCTS = {
  // 젬 패키지
  gem_100: { gems: 100, priceKRW: 2500, priceUSD: 1.99, name: '100 젬' },
  gem_500: { gems: 550, priceKRW: 10000, priceUSD: 7.99, name: '550 젬' },
  gem_1000: { gems: 1200, priceKRW: 19000, priceUSD: 14.99, name: '1200 젬' },
  gem_3000: { gems: 3900, priceKRW: 50000, priceUSD: 39.99, name: '3900 젬' },
  // 프리미엄
  premium_monthly: { type: 'premium', days: 30, priceKRW: 12000, priceUSD: 9.99, name: '프리미엄 월간' },
  premium_yearly: { type: 'premium', days: 365, priceKRW: 99000, priceUSD: 79.99, name: '프리미엄 연간' },
};

// ═══════════════════════════════════════════════════════════════
// 토스페이먼츠 (국내)
// ═══════════════════════════════════════════════════════════════
const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;

// 토스 결제 준비
app.post('/api/toss/prepare', (req, res) => {
  const { discordId, productId } = req.body;
  
  if (!discordId || !productId) {
    return res.status(400).json({ error: 'Missing discordId or productId' });
  }
  
  const product = PRODUCTS[productId];
  if (!product) {
    return res.status(400).json({ error: 'Invalid product' });
  }
  
  const orderId = `ORDER_${Date.now()}_${discordId}`;
  
  res.json({
    clientKey: TOSS_CLIENT_KEY,
    orderId,
    orderName: `HOMELAND - ${product.name}`,
    amount: product.priceKRW,
    customerKey: discordId,
    successUrl: `${process.env.BASE_URL || 'https://luos1.github.io/homeland-discord-bot'}/success.html`,
    failUrl: `${process.env.BASE_URL || 'https://luos1.github.io/homeland-discord-bot'}/shop.html`,
    metadata: { discordId, productId },
  });
});

// 토스 결제 확인 (Webhook or 수동)
app.post('/api/toss/confirm', async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  
  try {
    // 토스페이먼츠 결제 승인 API 호출
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    
    const data = await response.json();
    
    if (data.status === 'DONE') {
      // 결제 성공 - Discord 봇에 알림
      await notifyBot(data.metadata.discordId, data.metadata.productId);
      res.json({ success: true, message: '결제 완료!' });
    } else {
      res.status(400).json({ error: '결제 실패', details: data });
    }
  } catch (error) {
    console.error('[Toss] Confirm error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Paddle (해외)
// ═══════════════════════════════════════════════════════════════
const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

// Paddle 가격 ID 매핑
const PADDLE_PRICES = {
  gem_100: process.env.PADDLE_PRICE_GEM_100,
  gem_500: process.env.PADDLE_PRICE_GEM_500,
  gem_1000: process.env.PADDLE_PRICE_GEM_1000,
  gem_3000: process.env.PADDLE_PRICE_GEM_3000,
  premium_monthly: process.env.PADDLE_PRICE_PREMIUM_MONTHLY,
  premium_yearly: process.env.PADDLE_PRICE_PREMIUM_YEARLY,
};

// Paddle Checkout 생성
app.post('/api/paddle/checkout', async (req, res) => {
  const { discordId, productId } = req.body;
  
  if (!discordId || !productId) {
    return res.status(400).json({ error: 'Missing discordId or productId' });
  }
  
  const priceId = PADDLE_PRICES[productId];
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid product or price not configured' });
  }
  
  try {
    // Paddle API로 Checkout 세션 생성
    const response = await fetch('https://api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: { discord_id: discordId, product_id: productId },
        checkout: {
          url: `${process.env.BASE_URL || 'https://luos1.github.io/homeland-discord-bot'}/success.html`,
        },
      }),
    });
    
    const data = await response.json();
    
    if (data.data?.checkout?.url) {
      res.json({ url: data.data.checkout.url });
    } else {
      res.status(400).json({ error: 'Failed to create checkout', details: data });
    }
  } catch (error) {
    console.error('[Paddle] Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Paddle Webhook
app.post('/api/paddle/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // TODO: Webhook 서명 검증
  
  try {
    const event = JSON.parse(req.body.toString());
    
    if (event.event_type === 'transaction.completed') {
      const { discord_id, product_id } = event.data.custom_data || {};
      
      if (discord_id && product_id) {
        await notifyBot(discord_id, product_id);
        console.log(`[Paddle] Payment completed for ${discord_id}: ${product_id}`);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('[Paddle] Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Discord 봇에 결제 알림
// ═══════════════════════════════════════════════════════════════
async function notifyBot(discordId, productId) {
  const product = PRODUCTS[productId];
  if (!product) return;
  
  const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;
  if (!BOT_WEBHOOK_URL) {
    console.log('[Payment] BOT_WEBHOOK_URL not set, skipping notification');
    return;
  }
  
  try {
    await fetch(BOT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_complete',
        discordId,
        productId,
        product,
      }),
    });
    console.log(`[Payment] Notified bot: ${discordId} -> ${productId}`);
  } catch (error) {
    console.error('[Payment] Failed to notify bot:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    toss: !!TOSS_CLIENT_KEY,
    paddle: !!PADDLE_API_KEY,
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Homeland Payment Server',
    version: '1.0.0',
    endpoints: [
      'POST /api/toss/prepare',
      'POST /api/toss/confirm',
      'POST /api/paddle/checkout',
      'POST /api/paddle/webhook',
      'GET /health',
    ],
  });
});

// ═══════════════════════════════════════════════════════════════
// 서버 시작
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`💳 Homeland Payment Server running on port ${PORT}`);
  console.log(`🇰🇷 Toss Payments: ${TOSS_CLIENT_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🌍 Paddle: ${PADDLE_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
});
