import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

if (!admin.apps.length) {
  try {
    const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      // サービスアカウントJSONをパース
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      // private_keyの改行コードを正しく処理
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase Admin] Initialized with Service Account');
    } else {
      admin.initializeApp();
      console.log('[Firebase Admin] Initialized with Default Credentials');
    }
  } catch (err) {
    console.error('[Firebase Admin] Initialization Error:', err);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
