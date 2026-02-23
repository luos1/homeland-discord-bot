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
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!userId) {
    console.error('[Stripe] No user ID in checkout session');
    return;
  }

  console.log(`[Stripe] Checkout completed for user ${userId}`);

  // Get character
  const character = await prisma.character.findUnique({
    where: { userId }
  });

  if (!character) {
    console.error(`[Stripe] Character not found for user ${userId}`);
    return;
  }

  // Create or update subscription record
  await prisma.premiumSubscription.upsert({
    where: { userId },
    create: {
      userId,
      tier: 'premium',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'active',
    }
  });

  // Update character premium status
  const premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.character.update({
    where: { id: character.id },
    data: { premiumUntil }
  });

  console.log(`[Stripe] Premium activated for ${character.name} until ${premiumUntil}`);
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

  console.log(`[Stripe] Subscription updated: ${subscriptionId} - ${status}`);

  // Find subscription by Stripe ID
  const premiumSub = await prisma.premiumSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId }
  });

  if (!premiumSub) {
    console.error(`[Stripe] Subscription not found: ${subscriptionId}`);
    return;
  }

  // Update subscription
  await prisma.premiumSubscription.update({
    where: { id: premiumSub.id },
    data: {
      status,
      currentPeriodStart,
      currentPeriodEnd,
    }
  });

  // Update character if active
  if (status === 'active') {
    const character = await prisma.character.findUnique({
      where: { userId: premiumSub.userId }
    });

    if (character) {
      await prisma.character.update({
        where: { id: character.id },
        data: { premiumUntil: currentPeriodEnd }
      });

      console.log(`[Stripe] Premium extended for ${character.name} until ${currentPeriodEnd}`);
    }
  }
}

/**
 * Handle subscription deleted/canceled
 */
async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;

  console.log(`[Stripe] Subscription deleted: ${subscriptionId}`);

  // Find subscription
  const premiumSub = await prisma.premiumSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId }
  });

  if (!premiumSub) {
    console.error(`[Stripe] Subscription not found: ${subscriptionId}`);
    return;
  }

  // Mark as canceled
  await prisma.premiumSubscription.update({
    where: { id: premiumSub.id },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    }
  });

  console.log(`[Stripe] Subscription canceled for user ${premiumSub.userId}`);

  // Note: Don't immediately remove premium status
  // Let it expire naturally at currentPeriodEnd
}

/**
 * Handle payment succeeded
 */
async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_paid / 100; // Convert from cents
  const currency = invoice.currency;
  const invoiceId = invoice.id;

  console.log(`[Stripe] Payment succeeded: ${invoiceId} - ${amount} ${currency}`);

  // Record payment history
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
