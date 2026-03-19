import { writable } from 'svelte/store';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * ログイン中のユーザー情報を管理する Svelte ストア
 */
export const user = writable<User | null>(null);

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
