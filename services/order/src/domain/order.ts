import type { CheckoutItem, OrderStatus } from '@ecommerce/contracts';

export interface ShippingAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'BR';
}

export interface OrderItemDraft {
  productId: string;
  quantity: number;
  name?: string;
  unitPriceAmount?: number;
}

export interface Order {
  id: string;
  displayId: string;
  userId: string;
  recipientEmail: string;
  status: OrderStatus;
  cartId: string;
  cartVersion: number;
  shippingAddress: ShippingAddress;
  reservationId?: string;
  paymentId?: string;
  totalAmount: number;
  currency: 'BRL';
  failureReason?: string;
  items: OrderItemDraft[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryReservationResult {
  id: string;
  orderId: string;
  expiresAt: string;
  items: Array<{
    productId: string;
    quantity: number;
    name: string;
    unitPriceAmount: number;
    currency: 'BRL';
  }>;
}

export function toCheckoutItems(order: Order): CheckoutItem[] {
  return order.items.map((item) => ({
    productId: item.productId,
    name: item.name ?? `Product ${item.productId}`,
    quantity: item.quantity,
    unitPrice: { amount: item.unitPriceAmount ?? 0, currency: 'BRL' },
  }));
}

export function compensationSteps(state: {
  reserved: boolean;
  paymentCreated: boolean;
  captured: boolean;
}) {
  const steps: Array<'REFUND_PAYMENT' | 'CANCEL_PAYMENT' | 'RELEASE_INVENTORY'> = [];
  if (state.captured) steps.push('REFUND_PAYMENT');
  else if (state.paymentCreated) steps.push('CANCEL_PAYMENT');
  if (state.reserved) steps.push('RELEASE_INVENTORY');
  return steps;
}
