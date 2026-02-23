/**
 * Stripe 결제 통합
 * 
 * - 프리미엄 구독 결제
 * - Webhook 처리
 * - 구독 관리
 */

// Stripe 초기화 (환경 변수에서 키 로드)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const PREMIUM_PRICES = {
  bronze: {
    monthly: process.env.STRIPE_PRICE_BRONZE_MONTHLY || 'price_bronze_monthly',
    yearly: process.env.STRIPE_PRICE_BRONZE_YEARLY || 'price_bronze_yearly'
  },
  silver: {
    monthly: process.env.STRIPE_PRICE_SILVER_MONTHLY || 'price_silver_monthly',
    yearly: process.env.STRIPE_PRICE_SILVER_YEARLY || 'price_silver_yearly'
  },
  gold: {
    monthly: process.env.STRIPE_PRICE_GOLD_MONTHLY || 'price_gold_monthly',
    yearly: process.env.STRIPE_PRICE_GOLD_YEARLY || 'price_gold_yearly'
  }
};

/**
 * 결제 세션 생성
 */
async function createCheckoutSession(userId, tier, period = 'monthly', metadata = {}) {
  if (!stripe) {
    return {
      success: false,
      error: 'Stripe가 설정되지 않았습니다. (STRIPE_SECRET_KEY 환경 변수 필요)'
    };
  }

  const priceId = PREMIUM_PRICES[tier]?.[period];

  if (!priceId) {
    return {
      success: false,
      error: '유효하지 않은 티어 또는 기간입니다.'
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.BASE_URL || 'https://homeland-bot.com'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL || 'https://homeland-bot.com'}/payment/cancel`,
      metadata: {
        userId,
        tier,
        period,
        ...metadata
      },
      customer_email: metadata.email,
      subscription_data: {
        metadata: {
          userId,
          tier
        }
      }
    });

    return {
      success: true,
      sessionId: session.id,
      url: session.url
    };
  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Webhook 이벤트 처리
 */
async function handleWebhook(rawBody, signature, prisma) {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return { success: false, error: 'STRIPE_WEBHOOK_SECRET not configured' };
  }

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, prisma);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, prisma);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, prisma);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object, prisma);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, prisma);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { success: true, event: event.type };
  } catch (error) {
    console.error('Webhook error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 결제 완료 처리
 */
async function handleCheckoutCompleted(session, prisma) {
  const { userId, tier } = session.metadata;

  if (!userId || !tier) {
    console.error('Missing userId or tier in session metadata');
    return;
  }

  // 구독 정보 저장
  await prisma.premiumSubscription.upsert({
    where: { userId },
    create: {
      userId,
      tier,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일 후
    },
    update: {
      tier,
      stripeSubscriptionId: session.subscription,
      status: 'active'
    }
  });

  console.log(`Premium subscription activated for user ${userId}: ${tier}`);
}

/**
 * 구독 업데이트 처리
 */
async function handleSubscriptionUpdated(subscription, prisma) {
  const { userId } = subscription.metadata;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  await prisma.premiumSubscription.update({
    where: { userId },
    data: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    }
  });

  console.log(`Subscription updated for user ${userId}: ${subscription.status}`);
}

/**
 * 구독 취소 처리
 */
async function handleSubscriptionDeleted(subscription, prisma) {
  const { userId } = subscription.metadata;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  await prisma.premiumSubscription.update({
    where: { userId },
    data: {
      status: 'canceled',
      canceledAt: new Date()
    }
  });

  console.log(`Subscription canceled for user ${userId}`);
}

/**
 * 결제 성공 처리
 */
async function handlePaymentSucceeded(invoice, prisma) {
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return;
  }

  // 구독 갱신 기록
  await prisma.paymentHistory.create({
    data: {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      amount: invoice.amount_paid / 100, // cents to dollars
      currency: invoice.currency,
      status: 'succeeded',
      paidAt: new Date(invoice.status_transitions.paid_at * 1000)
    }
  });

  console.log(`Payment succeeded for subscription ${subscriptionId}: $${invoice.amount_paid / 100}`);
}

/**
 * 결제 실패 처리
 */
async function handlePaymentFailed(invoice, prisma) {
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return;
  }

  await prisma.paymentHistory.create({
    data: {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'failed',
      failedAt: new Date()
    }
  });

  console.log(`Payment failed for subscription ${subscriptionId}`);
}

/**
 * 구독 취소 (사용자 요청)
 */
async function cancelSubscription(userId, prisma) {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  const subscription = await prisma.premiumSubscription.findUnique({
    where: { userId }
  });

  if (!subscription || !subscription.stripeSubscriptionId) {
    return { success: false, error: '구독 정보를 찾을 수 없습니다.' };
  }

  try {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    await prisma.premiumSubscription.update({
      where: { userId },
      data: {
        status: 'canceled',
        canceledAt: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 구독 정보 조회
 */
async function getSubscription(userId, prisma) {
  const subscription = await prisma.premiumSubscription.findUnique({
    where: { userId }
  });

  return subscription;
}

module.exports = {
  createCheckoutSession,
  handleWebhook,
  cancelSubscription,
  getSubscription,
  PREMIUM_PRICES
};
