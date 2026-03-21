import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';

const stripe = new Stripe(STRIPE_SECRET_KEY);

/**
 * 期限切れの依頼を掃除し、Stripeの仮押さえをキャンセルします。
 * 定期実行（Cron）されることを想定。
 */
export const GET = async () => {
  try {
    const now = Date.now();
    
    // 期限を過ぎた「open」ステータスの依頼を検索 (Admin SDK)
    const snapshot = await adminDb.collection('orders')
      .where('status', '==', 'open')
      .where('expiresAt', '<', now)
      .get();
    
    const results = [];

    for (const orderDoc of snapshot.docs) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;

      try {
        // 1. Stripe 仮押さえをキャンセル (存在する場合)
        if (order.paymentIntentId) {
          await stripe.paymentIntents.cancel(order.paymentIntentId);
          console.log(`[Expired Cleanup] Cancelled PI: ${order.paymentIntentId} for Order: ${orderId}`);
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
