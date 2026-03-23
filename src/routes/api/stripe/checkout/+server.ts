import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { adminDb } from '$lib/server/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId, title, amount, orderData } = await request.json();

    // 1. Stripe Checkout Session の作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: title || 'キャンパス・ハブ 依頼報酬',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
        metadata: { orderId }
      },
      success_url: `${request.headers.get('origin')}/orders/${orderId}?success=true`,
      cancel_url: `${request.headers.get('origin')}/order`,
    });

    // 2. Firestore に保存 (検証なし)
    console.log(`[Firestore] Saving order ${orderId} with sessionId: ${session.id}`);
    await adminDb.collection('orders').doc(orderId).set({
      ...orderData,
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent || null,
      status: 'pending_payment',
      updatedAt: Date.now()
    });

    // 3. フロントエンドに URL を返す
    return json({ url: session.url });

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err.message);
    return json({ error: err.message }, { status: 500 });
  }
};
