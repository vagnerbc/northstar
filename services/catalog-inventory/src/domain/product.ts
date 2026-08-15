export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  priceAmount: number;
  currency: 'BRL';
  availableQuantity: number;
}

export interface ReservationItemRequest {
  productId: string;
  quantity: number;
}

export interface ReservedItem extends ReservationItemRequest {
  name: string;
  unitPriceAmount: number;
  currency: 'BRL';
}

export interface InventoryReservation {
  id: string;
  orderId: string;
  status: 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: Date;
  items: ReservedItem[];
}
