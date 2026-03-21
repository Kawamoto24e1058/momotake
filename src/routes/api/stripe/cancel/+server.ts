import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { adminDb } from '$lib/server/firebase-admin';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId, reason } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. 注文情報を取得 (Admin SDKを使用)
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orderDoc.data() as any;

    const statusValue = reason === 'expired' ? 'expired' : 'cancelled';
    const docRef = adminDb.collection('orders').doc(orderId);

    if (!order.paymentIntentId) {
      console.warn(`[Stripe Cancel] No PaymentIntent for order: ${orderId}. Updating status to ${statusValue} only.`);
      await docRef.update({
        status: statusValue,
        updatedAt: Date.now()
      });
      return json({ success: true, warning: 'No payment intent to cancel' });
    }

    console.log(`[Stripe Cancel] Attempting to cancel PI: ${order.paymentIntentId} (Order: ${orderId}, Reason: ${reason})`);

    try {
      // Stripe キャンセル実行
      const canceledIntent = await stripe.paymentIntents.cancel(order.paymentIntentId);
      console.log(`[Stripe Cancel] Successfully canceled PI: ${canceledIntent.id}, Status: ${canceledIntent.status}`);
    } catch (stripeErr: any) {
      // すでにキャンセルされている、またはキャプチャ済みの場合はエラーを適切に処理
      const msg = stripeErr.message || '';
      if (msg.includes('already been canceled')) {
        console.warn(`[Stripe Cancel] PI ${order.paymentIntentId} was already canceled.`);
      } else if (msg.includes('cannot be canceled because it has a status of succeeded')) {
        console.error(`[Stripe Cancel] Cannot cancel PI ${order.paymentIntentId} because it is already captured.`);
        return json({ error: 'すでに決済が確定しているため、キャンセルできません。' }, { status: 400 });
      } else {
        console.error(`[Stripe Cancel] Stripe API Error:`, stripeErr);
        throw stripeErr;
      }
    }

    // Firestore ステータス更新
    await docRef.update({
      status: statusValue,
      updatedAt: Date.now()
    });

    return json({ success: true, status: statusValue });
  } catch (err: any) {
    console.error('Stripe Cancel Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
