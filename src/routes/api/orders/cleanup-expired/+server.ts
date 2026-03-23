import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/**
 * 期限切れの依頼を掃除し、Stripeの仮押さえをキャンセルします。
 * 定期実行（Cron）されることを想定。
 */
export const GET = async () => {
  try {
    const now = Date.now();
    // 1. 「open」ステータスの依頼のみを取得。expiresAt の比較はインデックス回避のため JS 側で行う。
    const snapshot = await adminDb.collection('orders')
      .where('status', '==', 'open')
      .get();
    
    // 現在時刻を過ぎたものを抽出
    const expiredDocs = snapshot.docs.filter(doc => (doc.data().expiresAt || 0) < now);
    
    const results = [];

    for (const orderDoc of expiredDocs) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;

      try {
        // 1. Stripe 仮押さえをキャンセル (存在する場合)
        if (order.paymentIntentId) {
          const pi = await stripe.paymentIntents.retrieve(order.paymentIntentId);
          if (['requires_payment_method', 'requires_capture', 'requires_confirmation', 'requires_action', 'processing'].includes(pi.status)) {
            await stripe.paymentIntents.cancel(order.paymentIntentId);
            console.log(`[Expired Cleanup] Cancelled PI: ${order.paymentIntentId} for Order: ${orderId}`);
          } else {
            console.log(`[Expired Cleanup] PI: ${order.paymentIntentId} is in status ${pi.status}, skipping cancellation.`);
          }
        }

        // 2. Firestore ステータスを「expired」に更新 (Admin SDK)
        await adminDb.collection('orders').doc(orderId).update({
          status: 'expired',
          updatedAt: Date.now()
        });

        results.push({ id: orderId, action: 'cancelled' });
      } catch (stripeErr: any) {
        console.error(`[Expired Cleanup] Error for Order ${orderId}:`, stripeErr);
        results.push({ id: orderId, error: stripeErr.message });
      }
    }

    return json({ 
      success: true, 
      processedCount: results.length,
      details: results 
    });
  } catch (err: any) {
    console.error('Cleanup Expired Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
