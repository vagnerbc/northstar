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

export interface CartItem {
  productId: string;
  quantity: number;
}
export interface Cart {
  id: string;
  userId: string;
  version: number;
  items: CartItem[];
  updatedAt: string;
}

export type OrderStatus =
  | 'CHECKOUT_REQUESTED'
  | 'INVENTORY_RESERVED'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_CAPTURED'
  | 'CONFIRMED'
  | 'COMPENSATING'
  | 'FAILED'
  | 'MANUAL_REVIEW';

export interface ShippingAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'BR';
}
export interface OrderItem {
  productId: string;
  quantity: number;
  name?: string;
  unitPriceAmount?: number;
}
export interface Order {
  id: string;
  displayId: string;
  status: OrderStatus;
  paymentId?: string;
  totalAmount: number;
  currency: 'BRL';
  failureReason?: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
export interface Page<T> {
  items: T[];
  nextCursor?: string;
}
export interface CheckoutAccepted {
  orderId: string;
  status: OrderStatus;
  statusUrl: string;
}
export interface PaymentSession {
  paymentId: string;
  provider: 'stripe' | 'fake';
  clientSecret: string;
  status: string;
}
