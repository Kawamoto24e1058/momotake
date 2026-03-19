import { json } from '@sveltejs/kit';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { questId, title, amount } = await request.json();

    if (!questId || !amount) {
      return json({ error: 'Missing questId or amount' }, { status: 400 });
    }

    // Stripe Checkout Session の作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: title || 'ギルド・クエスト報酬',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual', // 【最重要】支払いの確定を保留（仮押さえ）
        metadata: {
          questId: questId,
        },
      },
      // リクエスト元のオリジンを取得してリダイレクトURLを構築
      success_url: `${request.headers.get('origin')}/quests/${questId}?success=true`,
      cancel_url: `${request.headers.get('origin')}/order`,
    });

    return json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
