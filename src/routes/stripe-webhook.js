/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe events for premium subscriptions:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Stripe instance (initialized in server.js)
let stripe = null;

function setStripe(stripeInstance) {
  stripe = stripeInstance;
}

/**
 * Webhook endpoint
 * POST /api/stripe/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe] Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Price ID to Tier mapping
 */
function getTierFromPriceId(priceId) {
  const priceMap = {
    [process.env.STRIPE_PRICE_BRONZE_MONTHLY]: 'bronze',
    [process.env.STRIPE_PRICE_SILVER_MONTHLY]: 'silver',
    [process.env.STRIPE_PRICE_GOLD_MONTHLY]: 'gold',
    [process.env.STRIPE_PRICE_DIAMOND_MONTHLY]: 'diamond',
    [process.env.STRIPE_PRICE_ELITE_MONTHLY]: 'elite',
    [process.env.STRIPE_PRICE_STARTER_PACK]: 'starter',
    [process.env.STRIPE_PRICE_FOUNDER_PACK]: 'founder',
  };

  return priceMap[priceId] || null;
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;
  const subscriptionId = session.subscription;
  const customerId = session.customer;
  const amountTotal = session.amount_total / 100; // Convert from cents
  const currency = session.currency;

  if (!userId) {
    console.error('[Stripe] No user ID in checkout session');
    return;
  }

  console.log(`[Stripe] Checkout completed for user ${userId}, amount: ${amountTotal} ${currency}`);

  // Get character
  const character = await prisma.character.findUnique({
    where: { userId }
  });

  if (!character) {
    console.error(`[Stripe] Character not found for user ${userId}`);
    return;
  }

  // Get price ID from line items
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
  const priceId = lineItems.data[0]?.price?.id;
  const tier = getTierFromPriceId(priceId);

  if (!tier) {
    console.error(`[Stripe] Unknown price ID: ${priceId}`);
    return;
  }

  console.log(`[Stripe] Tier detected: ${tier}`);

  // Determine payment type
  const isSubscription = subscriptionId !== null;
  const isLifetime = tier === 'founder';
  const isOneTime = tier === 'starter';
  const type = isSubscription ? 'subscription' : 'one_time';

  // Calculate expiry date
  let expiresAt = null;
  if (isSubscription) {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  } else if (isLifetime) {
    expiresAt = new Date('2099-12-31'); // Far future for lifetime
  } else if (isOneTime) {
    expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours for Starter Pack
  }

  // Record in PremiumHistory
  await prisma.premiumHistory.create({
    data: {
      userId,
      tier,
      amount: amountTotal,
      type,
      purchasedAt: new Date(),
      expiresAt,
      stripeInvoiceId: session.invoice || null,
      stripeSubscriptionId: subscriptionId || null,
      stripePriceId: priceId,
    }
  });

  console.log(`[Stripe] Premium history recorded for ${tier}`);

  // Create or update subscription record
  if (isSubscription || isLifetime) {
    const planId = `${tier}_monthly`;
    
    await prisma.premiumSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        tier,
        startDate: new Date(),
        endDate: expiresAt,
        autoFight: false,
        autoPotion: false,
        autoConsumable: false,
      },
      update: {
        planId,
        tier,
        startDate: new Date(),
        endDate: expiresAt,
      }
    });

    console.log(`[Stripe] Premium ${tier} activated for ${character.name} until ${expiresAt}`);
  }

  // Handle one-time bonuses (Starter Pack)
  if (tier === 'starter') {
    await prisma.character.update({
      where: { id: character.id },
      data: {
        gold: { increment: 1000 },
        gems: { increment: 50 },
      }
    });

    console.log(`[Stripe] Starter Pack bonuses applied: +1000 gold, +50 gems`);
    
    // TODO: Add rare weapon box to inventory
  }

  // Handle Founder Pack bonuses
  if (tier === 'founder') {
    // Grant exclusive Founder title
    console.log(`[Stripe] Founder Pack activated - granting exclusive benefits`);
    // TODO: Add Founder title, credit listing, etc.
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const priceId = subscription.items?.data[0]?.price?.id;

  console.log(`[Stripe] Subscription updated: ${subscriptionId} - ${status}`);

  // Get tier from price ID
  const tier = getTierFromPriceId(priceId);

  if (!tier) {
    console.error(`[Stripe] Unknown price ID in subscription: ${priceId}`);
    return;
  }

  // Find subscription by user (we don't store stripeSubscriptionId in new schema)
  // Try to find by matching subscription data
  const premiumHistory = await prisma.premiumHistory.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
      type: 'subscription',
    },
    orderBy: { purchasedAt: 'desc' },
  });

  if (!premiumHistory) {
    console.error(`[Stripe] Subscription not found in history: ${subscriptionId}`);
    return;
  }

  const userId = premiumHistory.userId;

  // Update subscription endDate if active
  if (status === 'active') {
    await prisma.premiumSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: `${tier}_monthly`,
        tier,
        startDate: currentPeriodStart,
        endDate: currentPeriodEnd,
      },
      update: {
        tier,
        startDate: currentPeriodStart,
        endDate: currentPeriodEnd,
      }
    });

    console.log(`[Stripe] Premium ${tier} updated for user ${userId} until ${currentPeriodEnd}`);
  } else if (status === 'canceled' || status === 'past_due') {
    // Mark as expired but don't delete (let it expire naturally)
    console.log(`[Stripe] Subscription ${status} for user ${userId}`);
  }
}

/**
 * Handle subscription deleted/canceled
 */
async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;

  console.log(`[Stripe] Subscription deleted: ${subscriptionId}`);

  // Find user from history
  const premiumHistory = await prisma.premiumHistory.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
      type: 'subscription',
    },
    orderBy: { purchasedAt: 'desc' },
  });

  if (!premiumHistory) {
    console.error(`[Stripe] Subscription not found in history: ${subscriptionId}`);
    return;
  }

  const userId = premiumHistory.userId;

  // Delete the subscription record
  // This will let it expire at the current endDate
  await prisma.premiumSubscription.deleteMany({
    where: { userId }
  });

  console.log(`[Stripe] Subscription canceled for user ${userId}`);

  // Note: Don't immediately remove premium status
  // The benefits will expire when endDate is reached
}

/**
 * Handle payment succeeded
 */
async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_paid / 100; // Convert from cents
  const currency = invoice.currency;
  const invoiceId = invoice.id;
  const priceId = invoice.lines?.data[0]?.price?.id;

  console.log(`[Stripe] Payment succeeded: ${invoiceId} - ${amount} ${currency}`);

  // Get tier from price ID
  const tier = getTierFromPriceId(priceId);

  // Find user from subscription
  let userId = null;
  if (subscriptionId) {
    const previousHistory = await prisma.premiumHistory.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      orderBy: { purchasedAt: 'desc' },
    });

    if (previousHistory) {
      userId = previousHistory.userId;
    }
  }

  // Record in PremiumHistory (recurring payment)
  if (userId && tier) {
    await prisma.premiumHistory.create({
      data: {
        userId,
        tier,
        amount,
        type: 'subscription',
        purchasedAt: new Date(invoice.status_transitions.paid_at * 1000),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeInvoiceId: invoiceId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
      }
    });

    console.log(`[Stripe] Recurring payment recorded for ${tier}: ${invoiceId}`);
  }

  // Also record in PaymentHistory table for legacy compatibility
  await prisma.paymentHistory.create({
    data: {
      stripeInvoiceId: invoiceId,
      stripeSubscriptionId: subscriptionId,
      amount,
      currency,
      status: 'succeeded',
      paidAt: new Date(invoice.status_transitions.paid_at * 1000),
    }
  });

  console.log(`[Stripe] Payment recorded: ${invoiceId}`);
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_due / 100;
  const currency = invoice.currency;
  const invoiceId = invoice.id;

  console.log(`[Stripe] Payment failed: ${invoiceId} - ${amount} ${currency}`);

  // Record failed payment
  await prisma.paymentHistory.create({
    data: {
      stripeInvoiceId: invoiceId,
      stripeSubscriptionId: subscriptionId,
      amount,
      currency,
      status: 'failed',
      failedAt: new Date(),
    }
  });

  // Find subscription and mark as past_due
  const premiumSub = await prisma.premiumSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId }
  });

  if (premiumSub) {
    await prisma.premiumSubscription.update({
      where: { id: premiumSub.id },
      data: { status: 'past_due' }
    });

    console.log(`[Stripe] Subscription marked past_due for user ${premiumSub.userId}`);
  }
}

module.exports = { router, setStripe };
