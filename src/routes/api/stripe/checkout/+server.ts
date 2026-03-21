import { json } from '@sveltejs/kit';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import { env } from '$env/dynamic/public';
import { adminDb } from '$lib/server/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId, title, amount, orderData } = await request.json();

    if (!orderId || !amount || !orderData) {
      return json({ error: 'Missing orderId, amount, or orderData' }, { status: 400 });
    }

    // デバッグログ: 送金先IDを確認
    console.log(`[Stripe Checkout] Creating session for destination: ${env.PUBLIC_STRIPE_CONNECT_ACCOUNT_ID}`);

    // Stripe Checkout Session の作成
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
        capture_method: 'manual', // 支払いの確定を保留（仮押さえ）
        transfer_data: {
          destination: env.PUBLIC_STRIPE_CONNECT_ACCOUNT_ID, // 送金先（環境変数から取得）
        },
        application_fee_amount: Math.max(50, Math.floor(amount * 0.1)), // 手数料10% (最低50円)
        metadata: {
          orderId: orderId,
        },
      },
      // リクエスト元のオリジンを取得してリダイレクトURLを構築
      success_url: `${request.headers.get('origin')}/orders/${orderId}?success=true`,
      cancel_url: `${request.headers.get('origin')}/order`,
    });

    // Firestore にデータを保存 (Admin SDK を利用)
    // フロントエンドで作成したID をドキュメントIDとして使用
    try {
      console.log(`[Firestore] Saving order ${orderId} with PI: ${session.payment_intent}`);
      await adminDb.collection('orders').doc(orderId).set({
        ...orderData,
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent, // セッションからPI IDを保存
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'pending_payment' // 初期ステータス
      });
      
      // 保存後の確認 (念のため)
      const verifyDoc = await adminDb.collection('orders').doc(orderId).get();
      if (!verifyDoc.exists || !verifyDoc.data()?.paymentIntentId) {
        throw new Error('Failed to verify paymentIntentId persistence');
      }
      
      console.log(`[Firestore] Order persistence verified for: ${orderId}`);
    } catch (dbErr: any) {
      console.error(`[Firestore] Error saving/verifying order ${orderId}:`, dbErr);
      throw dbErr;
    }

    return json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
