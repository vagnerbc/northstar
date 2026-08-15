import { AppError } from '@ecommerce/http';
import type { ReservationItemRequest } from '../domain/product.js';
import type { CatalogRepository } from './ports.js';

export class CatalogApplication {
  public constructor(
    private readonly repository: CatalogRepository,
    private readonly reservationTtlMs: number,
  ) {}

  public list(cursor: string | undefined, limit: number) {
    return this.repository.list(cursor, limit);
  }

  public async get(productId: string) {
    const product = await this.repository.findById(productId);
    if (!product) throw new AppError('Product was not found.', 404, 'PRODUCT_NOT_FOUND');
    return product;
  }

  public async reserve(orderId: string, items: ReservationItemRequest[], correlationId: string) {
    if (items.length === 0)
      throw new AppError('At least one item is required.', 400, 'EMPTY_RESERVATION');
    return this.repository.reserve({
      orderId,
      items,
      correlationId,
      expiresAt: new Date(Date.now() + this.reservationTtlMs),
    });
  }

  public commit(orderId: string, correlationId: string) {
    return this.repository.commit(orderId, correlationId);
  }

  public release(orderId: string, correlationId: string) {
    return this.repository.release(orderId, correlationId);
  }
}
