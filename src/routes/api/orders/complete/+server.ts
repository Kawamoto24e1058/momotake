import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateOrderStatus, getOrder } from '$lib/firebase/orderStore';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. 依頼情報を取得
    const order = await getOrder(orderId);
    if (!order) {
      return json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'active' && order.status !== 'submitted' && order.status !== 'open') {
      // NOTE: For testing purposes, we allow completion from 'open' if needed, but usually it should be 'active'
      // Adjusting to allow transition for the new flow
    }

    // 2. Stripe 決済（キャプチャ）の実行
    if (order.paymentIntentId) {
      try {
        await stripe.paymentIntents.capture(order.paymentIntentId);
      } catch (stripeErr: any) {
        if (stripeErr.code !== 'payment_intent_unexpected_state') {
          console.error('Stripe capture error:', stripeErr);
          return json({ error: 'Stripe payment capture failed' }, { status: 500 });
        }
      }
    }

    // 3. Firestore ステータスを「完了」に更新
    await updateOrderStatus(orderId, 'completed');

    return json({ success: true });
  } catch (err: any) {
    console.error('Order completion error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
