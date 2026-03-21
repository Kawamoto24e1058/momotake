import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp, 
  orderBy, 
  type QueryDocumentSnapshot, 
  doc, 
  updateDoc, 
  onSnapshot, 
  type DocumentSnapshot, 
  FirestoreError 
} from 'firebase/firestore';
import type { Order, OrderStatus, Message } from '../types/order';

const ORDERS_COLLECTION = 'orders';

/**
 * 新しい依頼を作成し、Firestoreに保存します。
 */
export const createOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), {
      ...orderData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

/**
 * 受付中（募集中の案件）の依頼をすべて取得します。
 */
export const getOpenOrders = async (): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: QueryDocumentSnapshot) => {
      return {
        id: doc.id,
        ...doc.data()
      } as Order;
    });
  } catch (error) {
    console.error('Error getting open orders:', error);
    throw error;
  }
};

/**
 * ユーザーIDに基づいた依頼一覧を取得します（依頼者または配達員として）。
 */
export const getOrdersByRole = async (userId: string, role: 'client' | 'delivery'): Promise<Order[]> => {
  try {
    const field = role === 'client' ? 'clientId' : 'deliveryId';
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where(field, '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data()
    } as Order));
  } catch (error) {
    console.error('Error getting orders by role:', error);
    throw error;
  }
};

/**
 * 依頼のステータスを更新します。
 */
export const updateOrderStatus = async (id: string, status: OrderStatus, extraData: Partial<Order> = {}): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(docRef, { 
      status,
      ...extraData,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

/**
 * 実費とレシート情報を更新します
 */
export const updateOrderReimbursement = async (orderId: string, actualCost: number, receiptUrl: string) => {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    actualCost,
    receiptUrl,
    updatedAt: new Date().toISOString()
  });
};

/**
 * 実費を承認します
 */
export const approveOrderCost = async (orderId: string) => {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    costApproved: true,
    updatedAt: new Date().toISOString()
  });
};

/**
 * 依頼を完了にします
 */
export const completeOrder = async (orderId: string) => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(docRef, {
      status: 'completed', // Assuming 'completed' is a valid status
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error completing order:', error);
    throw error;
  }
};

/**
 * 特定の依頼の情報を取得します。
 */
export const getOrder = async (orderId: string): Promise<Order | null> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const docSnap = await getDocs(query(collection(db, ORDERS_COLLECTION), where('__name__', '==', orderId)));
    if (!docSnap.empty) {
      const d = docSnap.docs[0];
      return { id: d.id, ...d.data() } as Order;
    }
    return null;
  } catch (error) {
    console.error('Error getting order:', error);
    throw error;
  }
};

/**
 * 依頼をリアルタイムに監視します。
 */
export const subscribeToOrder = (id: string, callback: (order: Order | null) => void) => {
  return onSnapshot(doc(db, ORDERS_COLLECTION, id), (docSnap: DocumentSnapshot) => {
    if (docSnap.exists()) {
      callback({
        id: docSnap.id,
        ...docSnap.data()
      } as Order);
    } else {
      callback(null);
    }
  }, (error: FirestoreError) => {
    console.error('Error subscribing to order:', error);
  });
};

/**
 * 自分の依頼一覧をリアルタイム購読します。
 */
export const subscribeMyOrders = (userId: string, role: 'client' | 'delivery', callback: (orders: Order[]) => void) => {
  const field = role === 'client' ? 'clientId' : 'deliveryId';
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where(field, '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];
    callback(orders);
  });
};

/**
 * 募集中の依頼一覧をリアルタイム購読します。
 */
export const subscribeOpenOrders = (callback: (orders: Order[]) => void) => {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];
    callback(orders);
  });
};

/**
 * チャットメッセージを送信します。
 */
export const sendMessage = async (orderId: string, text: string, senderId: string): Promise<void> => {
  try {
    const messagesRef = collection(db, ORDERS_COLLECTION, orderId, 'messages');
    await addDoc(messagesRef, {
      text,
      senderId,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * チャットメッセージをリアルタイム購読します。
 */
export const subscribeToMessages = (orderId: string, callback: (messages: Message[]) => void) => {
  const messagesRef = collection(db, ORDERS_COLLECTION, orderId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Message[];
    callback(messages);
  });
};
