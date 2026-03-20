import { json } from '@sveltejs/kit';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import { PUBLIC_STRIPE_CONNECT_ACCOUNT_ID } from '$env/static/public';
import Stripe from 'stripe';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { orderId, title, amount } = await request.json();

    if (!orderId || !amount) {
      return json({ error: 'Missing orderId or amount' }, { status: 400 });
    }

    // デバッグログ: 送金先IDを確認
    console.log(`[Stripe Checkout] Creating session for destination: ${PUBLIC_STRIPE_CONNECT_ACCOUNT_ID}`);

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
          destination: PUBLIC_STRIPE_CONNECT_ACCOUNT_ID, // 送金先（環境変数から取得）
        },
        application_fee_amount: 100, // 運営手数料（100円固定、または計算ロジック適用）
        metadata: {
          orderId: orderId,
        },
      },
      // リクエスト元のオリジンを取得してリダイレクトURLを構築
      success_url: `${request.headers.get('origin')}/orders/${orderId}?success=true`,
      cancel_url: `${request.headers.get('origin')}/order`,
    });

    return json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
