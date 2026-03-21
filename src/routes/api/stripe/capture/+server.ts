import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { adminDb } from '$lib/server/firebase-admin';
import { calculatePlatformFee } from '$lib/utils/feeCalculator';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. 注文情報を取得 (Admin SDKを使用)
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return json({ error: 'Order not found' }, { status: 404 });
    }
    const order = { id: orderDoc.id, ...orderDoc.data() } as any;

    if (!order.paymentIntentId) {
      console.error(`[Stripe Capture] Missing PaymentIntent for order: ${orderId}`);
      return json({ 
        error: '決済情報（Payment Intent）が見つかりません。依頼を最初からやり直してください。' 
      }, { status: 400 });
    }

    // 2. 金額の合計（報酬 + 実費）と手数料を計算
    const totalAmount = order.reward + (order.actualCost || 0);
    const fee = calculatePlatformFee(order.reward);

    console.log(`[Stripe Capture] Capturing PI: ${order.paymentIntentId} for total: ¥${totalAmount}, fee: ¥${fee}`);

    // 3. Stripe キャプチャ実行
    const intent = await stripe.paymentIntents.capture(order.paymentIntentId, {
      amount_to_capture: totalAmount,
      application_fee_amount: fee,
    });

    // 4. ステータス更新 (Admin SDKを使用)
    await adminDb.collection('orders').doc(orderId).update({
      status: 'completed',
      updatedAt: Date.now()
    });

    return json({ success: true, intentId: intent.id });
  } catch (err: any) {
    console.error('Stripe Capture Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
