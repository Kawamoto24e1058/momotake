import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { adminDb } from '$lib/server/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const GET = async ({ url, locals }) => {
  try {
    const uid = url.searchParams.get('uid');
    if (!uid) return json({ error: 'UID is required' }, { status: 400 });

    // 1. Stripe Balance 取得 (Connect Accountを指定)
    // プロトタイプでは PUBLIC_STRIPE_CONNECT_ACCOUNT_ID を共通で使用
    const accountId = publicEnv.PUBLIC_STRIPE_CONNECT_ACCOUNT_ID;
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId
    });

    // 2. 累計利益 (Firestoreから計算)
    const completedOrders = await adminDb.collection('orders')
      .where('deliveryId', '==', uid)
      .where('status', '==', 'completed')
      .get();

    let totalProfit = 0;
    completedOrders.forEach(doc => {
      const data = doc.data();
      // 利益 = 謝礼 - 手数料
      const fee = Math.floor((data.reward || 0) * 0.1);
      const profit = (data.reward || 0) - Math.max(50, fee);
      totalProfit += profit;
    });

    return json({
      available: balance.available[0].amount, // 日本円想定
      pending: balance.pending[0].amount,
      totalProfit: totalProfit,
      currency: 'jpy'
    });
  } catch (err: any) {
    console.error('[Balance API] Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
