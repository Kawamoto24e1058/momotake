export type OrderStatus = 'pending_payment' | 'open' | 'active' | 'submitted' | 'completed' | 'cancelled' | 'expired';

export interface Order {
  id: string;
  clientId: string;
  deliveryId?: string;
  title: string;
  description: string;
  reward: number; // in Yen
  actualCost?: number; // 実費
  receiptUrl?: string; // レシート画像URL
  costApproved?: boolean; // 依頼主による承認
  status: OrderStatus;
  pickupLocationId: string;
  dropoffLocationId: string;
  pickupLocationName?: string; // For free text
  dropoffLocationName?: string; // For free text
  createdAt: number;
  updatedAt: number;
  stripeSessionId?: string;
  paymentIntentId?: string;
  expiresAt: number; // 期限 (Timestamp)
  acceptedAt?: number; // 受諾時刻
  reportedAt?: number; // 未着報告時刻
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
}
