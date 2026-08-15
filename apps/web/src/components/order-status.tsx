import { Badge } from '@chakra-ui/react';
import type { OrderStatus } from '../types';

const labels: Record<OrderStatus, string> = {
  CHECKOUT_REQUESTED: 'Checkout requested',
  INVENTORY_RESERVED: 'Inventory reserved',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAYMENT_AUTHORIZED: 'Payment authorized',
  PAYMENT_CAPTURED: 'Payment captured',
  CONFIRMED: 'Confirmed',
  COMPENSATING: 'Rolling back',
  FAILED: 'Failed',
  MANUAL_REVIEW: 'Manual review',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const color =
    status === 'CONFIRMED'
      ? 'green'
      : status === 'FAILED' || status === 'MANUAL_REVIEW'
        ? 'red'
        : 'blue';
  return (
    <Badge colorPalette={color} size="lg">
      {labels[status]}
    </Badge>
  );
}

export const terminalStatuses: OrderStatus[] = ['CONFIRMED', 'FAILED', 'MANUAL_REVIEW'];
