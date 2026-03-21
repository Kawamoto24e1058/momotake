import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

if (!admin.apps.length) {
  try {
    const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      console.log('[Firebase Admin] Attempting initialization with service account key...');
      
      // JSON文字列のクリーンアップ: 改行コードのエスケープなどを処理
      let cleanedKey = serviceAccountKey.trim();
      if (cleanedKey.includes('\\n')) {
        cleanedKey = cleanedKey.replace(/\\n/g, '\n');
      }

      try {
        const serviceAccount = JSON.parse(cleanedKey);
        
        // 個別のフィールドでも改行コードを修正（念のため）
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'momotake-2f30b' // 確実にプロジェクトIDを指定
        });
        console.log('[Firebase Admin] Initialized successfully with Service Account');
      } catch (parseErr) {
        console.error('[Firebase Admin] JSON Parse Error. Falling back to default:', parseErr);
        admin.initializeApp({
          projectId: 'momotake-2f30b'
        });
      }
    } else {
      console.log('[Firebase Admin] No service account key found. Using default application credentials.');
      admin.initializeApp({
        projectId: 'momotake-2f30b'
      });
    }
  } catch (err) {
    console.error('[Firebase Admin] Critical Initialization Error:', err);
  }
} else {
  // すでに初期化済みの場合は既存のアプリを使用（二重初期化防止）
  console.log('[Firebase Admin] Already initialized. Using existing app instance.');
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
