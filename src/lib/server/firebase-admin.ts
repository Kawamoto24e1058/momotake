import admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACCOUNT_KEY } from '$env/static/private';

if (!admin.apps.length) {
  try {
    if (FIREBASE_SERVICE_ACCOUNT_KEY) {
      // サービスアカウントJSONをパース
      // 文字列として直接渡された場合やダブルクォートで囲まれている場合に対応
      const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY);
      
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
