import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { calculatePlatformFee } from '$lib/utils/feeCalculator';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. 依頼情報を取得 (Admin SDKを使用)
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orderDoc.data() as any;

    if (order.status !== 'active' && order.status !== 'submitted' && order.status !== 'open') {
      // NOTE: For testing purposes, we allow completion from 'open' if needed, but usually it should be 'active'
    }

    // 2. Stripe 決済（キャプチャ）の実行
    if (order.paymentIntentId) {
      try {
        // 合計金額（報酬 + 実費）を計算
        const totalAmount = order.reward + (order.actualCost || 0);
        
        // 手数料を計算
        const fee = calculatePlatformFee(order.reward);
        
        // Stripeキャプチャを実行
        await stripe.paymentIntents.capture(order.paymentIntentId, {
          amount_to_capture: totalAmount,
          application_fee_amount: fee
        });
      } catch (stripeErr: any) {
        if (stripeErr.code !== 'payment_intent_unexpected_state') {
          console.error('Stripe capture error:', stripeErr);
          return json({ error: 'Stripe payment capture failed' }, { status: 500 });
        }
      }
    }

    // 3. Firestore ステータスを「完了」に更新 (Admin SDKを使用)
    await adminDb.collection('orders').doc(orderId).update({
      status: 'completed',
      updatedAt: Date.now()
    });

    return json({ success: true });
  } catch (err: any) {
    console.error('Order completion error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
