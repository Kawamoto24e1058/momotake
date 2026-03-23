import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

if (!admin.apps.length) {
  try {
    const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      console.log('[Firebase Admin] Attempting initialization with deep cleaning...');
      
      let cleanedKey = serviceAccountKey.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();

      try {
        const serviceAccount = JSON.parse(cleanedKey);
        
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: "momotake-2f30b",
          storageBucket: "momotake-2f30b.firebasestorage.app"
        });
        console.log('[Firebase Admin] Deep Cleaned Initialization SUCCESS');
      } catch (parseErr) {
        console.error('[Firebase Admin] JSON Parse ERROR after cleaning:', parseErr);
        admin.initializeApp({
          projectId: "momotake-2f30b",
          storageBucket: "momotake-2f30b.firebasestorage.app"
        });
      }
    } else {
      console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY is missing');
      admin.initializeApp({
        projectId: "momotake-2f30b",
        storageBucket: "momotake-2f30b.firebasestorage.app"
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
export const adminStorage = admin.storage();
