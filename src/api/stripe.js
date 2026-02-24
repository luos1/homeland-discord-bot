const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const PRODUCTS = {
  gem_100: { gems: 100, price: 199, name: '100 젬' },
  gem_500: { gems: 550, price: 799, name: '550 젬' },
  gem_1000: { gems: 1200, price: 1499, name: '1200 젬' },
  gem_3000: { gems: 3900, price: 3999, name: '3900 젬' },
  premium_monthly: { type: 'premium', days: 30, price: 999, name: '프리미엄 월간' },
  premium_yearly: { type: 'premium', days: 365, price: 7999, name: '프리미엄 연간' },
};

function createStripeRouter(prisma, client) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // CORS for web shop
  router.use(cors({
    origin: [
      'https://luos1.github.io',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ],
  }));

  router.use(express.json());

  // Create checkout session
  router.post('/checkout', async (req, res) => {
    try {
      const { discordId, productId } = req.body;

      if (!discordId || !productId) {
        return res.status(400).json({ error: 'Missing discordId or productId' });
      }

      const product = PRODUCTS[productId];
      if (!product) {
        return res.status(400).json({ error: 'Invalid product' });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `HOMELAND - ${product.name}`,
                description: product.gems 
                  ? `${product.gems} 젬을 Discord 캐릭터에 지급합니다`
                  : `프리미엄 ${product.days}일 이용권`,
              },
              unit_amount: product.price,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.BASE_URL || 'https://luos1.github.io/homeland-discord-bot'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL || 'https://luos1.github.io/homeland-discord-bot'}/shop.html`,
        metadata: {
          discordId,
          productId,
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('[Stripe] Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook handler
  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('[Stripe] Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { discordId, productId } = session.metadata;
      const product = PRODUCTS[productId];

      if (!product) {
        console.error('[Stripe] Unknown product:', productId);
        return res.status(400).send('Unknown product');
      }

      try {
        // Find character by Discord ID
        const character = await prisma.character.findFirst({
          where: { odUserId: discordId },
        });

        if (!character) {
          console.error('[Stripe] Character not found for Discord ID:', discordId);
          // Store for later claim
          await prisma.pendingPurchase.create({
            data: {
              odUserId: discordId,
              productId,
              sessionId: session.id,
              amount: session.amount_total,
            },
          });
          return res.json({ received: true, pending: true });
        }

        if (product.gems) {
          // Add gems
          await prisma.character.update({
            where: { id: character.id },
            data: { gems: { increment: product.gems } },
          });
          console.log(`[Stripe] Added ${product.gems} gems to ${character.name}`);

          // Send DM notification
          try {
            const user = await client.users.fetch(discordId);
            await user.send(`💎 **${product.gems}젬**이 지급되었습니다!\n캐릭터: ${character.name}\n감사합니다! 🎉`);
          } catch (dmError) {
            console.error('[Stripe] Failed to send DM:', dmError);
          }
        } else if (product.type === 'premium') {
          // Add premium subscription
          const now = new Date();
          const endDate = new Date(now.getTime() + product.days * 24 * 60 * 60 * 1000);

          await prisma.premiumSubscription.upsert({
            where: { odUserId: discordId },
            update: {
              endDate,
              updatedAt: now,
            },
            create: {
              odUserId: discordId,
              startDate: now,
              endDate,
            },
          });
          console.log(`[Stripe] Added ${product.days} days premium to ${character.name}`);

          // Send DM notification
          try {
            const user = await client.users.fetch(discordId);
            await user.send(`⭐ **프리미엄 패스**가 활성화되었습니다!\n기간: ${product.days}일\n캐릭터: ${character.name}\n감사합니다! 🎉`);
          } catch (dmError) {
            console.error('[Stripe] Failed to send DM:', dmError);
          }
        }

        res.json({ received: true });
      } catch (error) {
        console.error('[Stripe] Fulfillment error:', error);
        res.status(500).json({ error: error.message });
      }
    } else {
      res.json({ received: true });
    }
  });

  return router;
}

module.exports = { createStripeRouter, PRODUCTS };
