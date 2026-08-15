import { AppError } from '@ecommerce/http';

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  userId: string;
  version: number;
  items: CartItem[];
  updatedAt: Date;
}

export function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new AppError('Quantity must be an integer between 1 and 99.', 400, 'INVALID_QUANTITY');
  }
}
