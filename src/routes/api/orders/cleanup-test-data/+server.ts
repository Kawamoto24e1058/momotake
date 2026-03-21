import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

export const GET = async () => {
  try {
    const snapshot = await adminDb.collection('orders').get();
    const batch = adminDb.batch();
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      // paymentIntentId がないもの、またはタイトルに「お茶」が含まれるものを削除
      if (!data.paymentIntentId || (data.title && data.title.includes('お茶'))) {
        batch.delete(doc.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return json({ success: true, deletedCount: count });
  } catch (err: any) {
    console.error('Cleanup Error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
