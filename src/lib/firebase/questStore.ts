import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, type QueryDocumentSnapshot, doc, updateDoc, onSnapshot, type DocumentSnapshot, FirestoreError } from 'firebase/firestore';
import type { Quest } from '../types/quest';

const QUESTS_COLLECTION = 'quests';

/**
 * 新しいクエストを作成し、Firestoreに保存します。
 */
export const createQuest = async (questData: Omit<Quest, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, QUESTS_COLLECTION), {
      ...questData,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating quest:', error);
    throw error;
  }
};

/**
 * ステータスが 'open' のクエストをすべて取得します。
 */
export const getOpenQuests = async (): Promise<Quest[]> => {
  try {
    const q = query(
      collection(db, QUESTS_COLLECTION),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate()
      } as Quest;
    });
  } catch (error) {
    console.error('Error getting open quests:', error);
    throw error;
  }
};

/**
 * クエストのステータスを任意の値に更新します。
 * @param id クエストID
 * @param status 新しいステータス
 */
export const updateQuestStatus = async (id: string, status: Quest['status']): Promise<void> => {
  try {
    const docRef = doc(db, QUESTS_COLLECTION, id);
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error('Error updating quest status:', error);
    throw error;
  }
};

/**
 * クエストのステータスを 'completed' に更新します。
 * @param id クエストID
 */
export const completeQuest = async (id: string): Promise<void> => {
  return updateQuestStatus(id, 'completed');
};

/**
 * 特定のクエストの情報をリアルタイムに監視します。
 * @param id クエストID
 * @param callback データ更新時に呼ばれる関数
 * @returns 監視を停止するための unsubcribe 関数
 */
export const subscribeToQuest = (id: string, callback: (quest: Quest | null) => void) => {
  return onSnapshot(doc(db, QUESTS_COLLECTION, id), (docSnap: DocumentSnapshot) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate()
      } as Quest);
    } else {
      callback(null);
    }
  }, (error: FirestoreError) => {
    console.error('Error subscribing to quest:', error);
  });
};
