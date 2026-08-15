import type { Cart } from '../domain/cart.js';

export interface CartRepository {
  getOrCreate(userId: string): Promise<Cart>;
  add(userId: string, productId: string, quantity: number): Promise<Cart>;
  setQuantity(userId: string, productId: string, quantity: number): Promise<Cart>;
  remove(userId: string, productId: string): Promise<Cart>;
  removePurchased(input: {
    eventId: string;
    eventType: string;
    userId: string;
    items: Array<{ productId: string; quantity: number }>;
  }): Promise<void>;
  isReady(): Promise<boolean>;
}

export interface ProductCatalog {
  exists(productId: string): Promise<boolean>;
}
