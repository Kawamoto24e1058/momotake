import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { adminDb } from '$lib/server/firebase-admin';
import { calculatePlatformFee } from '$lib/utils/feeCalculator';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  let orderId = '';
  try {
    const body = await request.json();
    orderId = body.orderId;
    const { paymentIntentId, amountToCapture } = body;

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. 注文情報を取得 (Admin SDKを使用)
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return json({ error: 'Order not found' }, { status: 404 });
    }
    const order = { id: orderDoc.id, ...orderDoc.data() } as any;

    const piId = paymentIntentId || order.paymentIntentId;
    if (!piId) {
      console.error(`[Stripe Capture] Missing PaymentIntent for order: ${orderId}`);
      return json({ error: '決済情報が見つかりません。' }, { status: 400 });
    }

    // 2. 金額の合計と手数料を計算
    const reward = order.reward || 0;
    const actualCost = order.actualCost || 0;
    // JPYなので整数値であることを保証
    const finalAmount = amountToCapture ? Math.floor(Number(amountToCapture)) : (reward + actualCost);
    const fee = calculatePlatformFee(reward);

    console.log(`[Stripe Capture] Order: ${orderId}, PI: ${piId}, Requested: ¥${finalAmount}, Fee: ¥${fee}`);

    // 3. Stripeから現在のPaymentIntentの状態を取得して上限をチェック
    const intentStatus = await stripe.paymentIntents.retrieve(piId);
    
    if (finalAmount > (intentStatus.amount_capturable || 0)) {
      console.warn(`[Stripe Capture] Amount exceeded! Requested: ¥${finalAmount}, Capturable: ¥${intentStatus.amount_capturable}`);
      return json({ 
        error: `金額（¥${finalAmount}）が事前承認枠（¥${intentStatus.amount_capturable}）を超えています。`,
        code: 'AMOUNT_EXCEEDED',
        limit: intentStatus.amount_capturable
      }, { status: 400 });
    }

    // 4. Stripe キャプチャ実行
    console.log(`[Stripe Capture] Executing stripe.paymentIntents.capture for PI: ${piId}...`);
    const intent = await stripe.paymentIntents.capture(piId, {
      amount_to_capture: finalAmount,
      application_fee_amount: fee,
    });

    console.log(`[Stripe Capture] SUCCESS: Intent ID = ${intent.id}, Status = ${intent.status}`);

    // 5. ステータス更新 (Admin SDKを使用)
    console.log(`[Stripe Capture] Updating Firestore status to 'completed' for order: ${orderId}`);
    await adminDb.collection('orders').doc(orderId).update({
      status: 'completed',
      updatedAt: Date.now()
    });

    return json({ success: true, intentId: intent.id });
  } catch (err: any) {
    console.error('------- STRIPE CAPTURE ERROR START -------');
    console.error('Order ID:', orderId);
    if (err.raw) {
      console.error('Raw Stripe Error:', JSON.stringify(err.raw, null, 2));
    }
    console.error('Error Message:', err.message);
    if (err.stack) console.error('Stack Trace:', err.stack);
    console.error('------- STRIPE CAPTURE ERROR END -------');
    
    return json({ 
      error: err.message, 
      details: err.raw,
      code: err.code || 'CAPTURE_FAILED' 
    }, { status: 500 });
  }
};
