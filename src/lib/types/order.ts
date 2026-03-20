export type OrderStatus = 'pending_payment' | 'open' | 'active' | 'submitted' | 'completed' | 'cancelled';

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
}
