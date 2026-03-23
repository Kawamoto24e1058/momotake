import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. Firestore から注文情報を取得
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orderDoc.data() as any;

    if (!order.stripeSessionId) {
      return json({ error: 'Stripe Session ID not found in order' }, { status: 400 });
    }

    // 2. Stripe からセッション情報を取得
    console.log(`[Verify Session] Checking Stripe Session: ${order.stripeSessionId} for Order: ${orderId}`);
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

    // 3. 支払い状況を確認
    // Stripe Checkout Session が 'paid' または 'complete' であれば支払い完了とみなす
    if (session.payment_status === 'paid' || session.status === 'complete') {
      console.log(`[Verify Session] Payment confirmed for Order: ${orderId} (Stripe Status: ${session.status}). Updating Firestore...`);
      
      const updateData: any = {
        status: 'open',
        updatedAt: Date.now()
      };

      // paymentIntentId が取れれば保存しておく
      if (session.payment_intent) {
        updateData.paymentIntentId = typeof session.payment_intent === 'string' 
          ? session.payment_intent 
          : session.payment_intent.id;
      }

      // Firestore を強制更新
      await adminDb.collection('orders').doc(orderId).update(updateData);
      
      return json({ success: true, status: 'open', paymentIntentId: updateData.paymentIntentId });
    } else {
      console.log(`[Verify Session] Session status is ${session.payment_status}. No update performed.`);
      return json({ success: false, status: order.status, payment_status: session.payment_status });
    }

  } catch (err: any) {
    console.error('Verify Session Error:', err.message);
    return json({ error: err.message }, { status: 500 });
  }
};
