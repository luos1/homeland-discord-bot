/**
 * Payment Server - Stripe Integration
 * 
 * Standalone Express server for handling Stripe webhooks and checkout sessions
 * Runs separately from Discord bot to ensure payment processing continues even if bot restarts
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { handleWebhook, createCheckoutSession } = require('./game/payment-stripe');

const prisma = new PrismaClient();
const app = express();

// Port for payment server (separate from bot)
const PORT = process.env.PAYMENT_PORT || 3000;

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://homeland-bot.com'],
  credentials: true
}));

// Health check (no body parsing)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'homeland-payment-server',
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY
  });
});

// Stripe webhook endpoint (raw body needed for signature verification)
app.post('/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('No signature provided');
    }

    try {
      const result = await handleWebhook(req.body, signature, prisma);

      if (result.success) {
        console.log(`[Webhook] Processed: ${result.event}`);
        res.json({ received: true, event: result.event });
      } else {
        console.error(`[Webhook] Error: ${result.error}`);
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('[Webhook] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// JSON body parser for other endpoints
app.use(express.json());

/**
 * Create checkout session
 * POST /api/checkout/create
 * Body: { userId, tier, period, email }
 */
app.post('/api/checkout/create', async (req, res) => {
  const { userId, tier, period, email } = req.body;

  if (!userId || !tier) {
    return res.status(400).json({ error: 'userId and tier required' });
  }

  try {
    const result = await createCheckoutSession(userId, tier, period || 'monthly', { email });

    if (result.success) {
      res.json({
        sessionId: result.sessionId,
        url: result.url
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('[Checkout] Error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * Get subscription status
 * GET /api/subscription/:userId
 */
app.get('/api/subscription/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const subscription = await prisma.premiumSubscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      active: subscription.status === 'active'
    });
  } catch (error) {
    console.error('[Subscription] Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * Payment success page
 * GET /payment/success
 */
app.get('/payment/success', (req, res) => {
  const { session_id } = req.query;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful - Homeland RPG</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 500px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .success-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #5568d3;
        }
        .session-id {
          font-size: 12px;
          color: #999;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
        <h1>Payment Successful!</h1>
        <p>
          Thank you for subscribing to Homeland Premium!<br>
          Your benefits are now active in Discord.
        </p>
        <p>
          Return to Discord and enjoy your premium perks:<br>
          • 20% XP Boost<br>
          • 15% Gold Boost<br>
          • Daily Gems<br>
          • Exclusive Benefits
        </p>
        <a href="https://discord.com/channels/@me" class="btn">Return to Discord</a>
        ${session_id ? `<div class="session-id">Session ID: ${session_id}</div>` : ''}
      </div>
      <script>
        // Auto-close after 10 seconds
        setTimeout(() => window.close(), 10000);
      </script>
    </body>
    </html>
  `);
});

/**
 * Payment canceled page
 * GET /payment/cancel
 */
app.get('/payment/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Canceled - Homeland RPG</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 500px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .cancel-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: background 0.3s;
          margin: 0 10px;
        }
        .btn:hover {
          background: #5568d3;
        }
        .btn-secondary {
          background: #6c757d;
        }
        .btn-secondary:hover {
          background: #5a6268;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="cancel-icon">❌</div>
        <h1>Payment Canceled</h1>
        <p>
          Your payment was not completed.<br>
          No charges have been made to your account.
        </p>
        <p>
          You can try again anytime using the <code>/premium subscribe</code> command in Discord.
        </p>
        <a href="https://discord.com/channels/@me" class="btn">Return to Discord</a>
      </div>
      <script>
        // Auto-close after 10 seconds
        setTimeout(() => window.close(), 10000);
      </script>
    </body>
    </html>
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, closing connections...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, closing connections...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`💳 Payment server running on port ${PORT}`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/api/stripe/webhook`);
  console.log(`🔒 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});

module.exports = app;
