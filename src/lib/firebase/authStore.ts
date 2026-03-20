import { writable } from 'svelte/store';
import { auth, googleProvider, db } from './firebase';
export { auth };
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * ログイン中のユーザー情報を管理する Svelte ストア
 */
export const user = writable<User | null>(null);

/**
 * 認証初期化状態を管理するストア
 * true: 初期化中, false: 完了
 */
export const loading = writable<boolean>(true);

// 認証状態の変化を監視
let initialAuthChecked = false;
onAuthStateChanged(auth, (u) => {
  user.set(u);
  initialAuthChecked = true;
  loading.set(false);
});

/**
 * Google 認証を使用してログインします。
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const u = result.user;

    // Firestore にユーザー情報を同期（初回のみ）
    const userRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        photoURL: u.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // 最終ログイン日時などを更新
      await setDoc(userRef, {
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    return u;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * ログアウトします。
 */
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};
