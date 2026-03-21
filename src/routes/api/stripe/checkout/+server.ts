import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { adminDb } from '$lib/server/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId, title, amount, orderData } = await request.json();

    if (!orderId || !amount || !orderData) {
      return json({ error: 'Missing orderId, amount, or orderData' }, { status: 400 });
    }

    // デバッグログ: 送金先IDを確認
    const destination = publicEnv.PUBLIC_STRIPE_CONNECT_ACCOUNT_ID;
    console.log(`[Stripe Checkout] Creating session for destination: ${destination}`);

    // 手数料計算 (10%, 最低50円) - 確実に整数にする
    const feeAmount = Math.round(Math.max(50, amount * 0.1));

    // payment_intent_data の構築
    const paymentIntentData: any = {
      capture_method: 'manual', // 支払いの確定を保留（仮押さえ）
      metadata: {
        orderId: orderId,
      },
    };

    // 送金先が設定されている場合のみ、手数料と送金データを追加
    if (destination) {
      paymentIntentData.transfer_data = {
        destination: destination,
      };
      paymentIntentData.application_fee_amount = feeAmount;
    }

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
      payment_intent_data: paymentIntentData,
      // リクエスト元のオリジンを取得してリダイレクトURLを構築
      success_url: `${request.headers.get('origin')}/orders/${orderId}?success=true`,
      cancel_url: `${request.headers.get('origin')}/order`,
    });

    // Firestore にデータを保存 (Admin SDK を利用)
    try {
      console.log(`[Firestore] Attempting to save order ${orderId}...`);
      const orderDocRef = adminDb.collection('orders').doc(orderId);
      
      const saveData = {
        ...orderData,
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'pending_payment'
      };

      console.log(`[Firestore] Writing data for ${orderId}: PI=${session.payment_intent}`);
      await orderDocRef.set(saveData);
      
      // 保存後の即時確認
      console.log(`[Firestore] Verifying persistence for ${orderId}...`);
      const verifyDoc = await orderDocRef.get();
      
      if (!verifyDoc.exists) {
        console.error(`[Firestore] ERROR: Document ${orderId} does not exist after set()!`);
        throw new Error(`Persistence verification failed: Document ${orderId} not found`);
      }

      const savedData = verifyDoc.data();
      if (!savedData?.paymentIntentId) {
        console.error(`[Firestore] ERROR: paymentIntentId is missing in saved document:`, savedData);
        throw new Error('Persistence verification failed: paymentIntentId missing');
      }
      
      console.log(`[Firestore] SUCCESS: Order ${orderId} saved and verified.`);
    } catch (dbErr: any) {
      console.error(`[Firestore] CRITICAL ERROR saving/verifying order ${orderId}:`, {
        message: dbErr.message,
        stack: dbErr.stack,
        orderId: orderId,
        paymentIntentId: session.payment_intent
      });
      throw dbErr;
    }

    return json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
