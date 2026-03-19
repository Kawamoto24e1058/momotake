export interface Quest {
  id: string;
  clientId: string;
  walkerId: string | null;
  status: 'pending_payment' | 'open' | 'active' | 'submitted' | 'completed' | 'canceled';
  pickupLocationId: string;
  dropoffLocationId: string;
  reward: number;
  itemPrice: number;
  createdAt: Date;
}
