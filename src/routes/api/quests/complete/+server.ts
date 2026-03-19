import { json } from '@sveltejs/kit';
import { db } from '$lib/firebase/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const POST = async ({ request }) => {
  try {
    const { questId } = await request.json();

    if (!questId) {
      return json({ error: 'Missing questId' }, { status: 400 });
    }

    // 1. Firestore の該当クエストを 'completed' に更新
    const questRef = doc(db, 'quests', questId);
    await updateDoc(questRef, { 
      status: 'completed',
      completedAt: new Date()
    });

    // 2. Stripe の売上確定（キャプチャ）処理
    // TODO: Firestore から PaymentIntent ID を取得し、stripe.paymentIntents.capture を実行する
    // const stripe = new Stripe(STRIPE_SECRET_KEY);
    // await stripe.paymentIntents.capture(paymentIntentId);

    return json({ success: true });
  } catch (err: any) {
    console.error('Quest Completion API Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
