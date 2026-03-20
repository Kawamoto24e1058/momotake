import { json } from '@sveltejs/kit';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import { getOrder, updateOrderStatus } from '$lib/firebase/orderStore';
import { calculatePlatformFee } from '$lib/utils/feeCalculator';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 1. 注文情報を取得
    const order = await getOrder(orderId);
    if (!order) {
      return json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.paymentIntentId) {
      return json({ error: 'No payment intent associated with this order' }, { status: 400 });
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

    // 4. ステータス更新
    await updateOrderStatus(orderId, 'completed');

    return json({ success: true, intentId: intent.id });
  } catch (err: any) {
    console.error('Stripe Capture Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
