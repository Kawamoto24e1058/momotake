import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = async ({ request }) => {
  try {
    const { userId, origin } = await request.json();

    if (!userId) {
      throw error(400, 'User ID is required');
    }

    // 1. ユーザー情報を取得
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw error(404, 'User not found');
    }

    let stripeAccountId = userDoc.data()?.stripeAccountId;

    // 2. アカウントがない場合は新規作成 (Express)
    if (!stripeAccountId) {
      console.log(`[Stripe Onboarding] Creating new Express account for: ${userId}`);
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { userId }
      });
      stripeAccountId = account.id;
      
      // Firestore に ID を保存
      await userRef.update({ stripeAccountId });
    }

    // 3. オンボーディング URL の生成
    console.log(`[Stripe Onboarding] Generating link for account: ${stripeAccountId}`);
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/?tab=deliver`,
      return_url: `${origin}/?tab=deliver`,
      type: 'account_onboarding',
    });

    return json({ url: accountLink.url });
  } catch (err: any) {
    console.error('[Stripe Onboarding] Error:', err.message);
    return json({ error: err.message }, { status: 500 });
  }
};
