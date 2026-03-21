import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

if (!admin.apps.length) {
  try {
    const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      console.log('[Firebase Admin] Attempting initialization with deep cleaning...');
      
      // 1. 制御文字や目に見えない改行を徹底的に除去
      // Bad control character (position 158) などのエラーを防ぐ
      let cleanedKey = serviceAccountKey.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();

      try {
        const serviceAccount = JSON.parse(cleanedKey);
        
        // 2. プライベートキー内の改行コードを Google が認識できる形式 (\n) に戻す
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        // 3. projectId を直接指定して確実に初期化
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: "momotake-2f30b"
        });
        console.log('[Firebase Admin] Deep Cleaned Initialization SUCCESS');
      } catch (parseErr) {
        console.error('[Firebase Admin] JSON Parse ERROR after cleaning:', parseErr);
        // フォールバック: プロジェクトIDのみで初期化
        admin.initializeApp({
          projectId: "momotake-2f30b"
        });
      }
    } else {
      console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY is missing');
      admin.initializeApp({
        projectId: "momotake-2f30b"
      });
    }
  } catch (err) {
    console.error('[Firebase Admin] CRITICAL INIT ERROR:', err);
  }
} else {
  console.log('[Firebase Admin] App already exists.');
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
