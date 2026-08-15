import type { InventoryReservation, Product, ReservationItemRequest } from '../domain/product.js';

export interface ProductPage {
  items: Product[];
  nextCursor?: string;
}

export interface CatalogRepository {
  list(cursor: string | undefined, limit: number): Promise<ProductPage>;
  findById(productId: string): Promise<Product | null>;
  reserve(input: {
    orderId: string;
    items: ReservationItemRequest[];
    expiresAt: Date;
    correlationId: string;
  }): Promise<InventoryReservation>;
  commit(orderId: string, correlationId: string): Promise<InventoryReservation>;
  release(orderId: string, correlationId: string): Promise<InventoryReservation>;
  isReady(): Promise<boolean>;
}
