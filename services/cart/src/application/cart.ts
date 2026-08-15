import { AppError } from '@ecommerce/http';
import { assertQuantity } from '../domain/cart.js';
import type { CartRepository, ProductCatalog } from './ports.js';

export class CartApplication {
  public constructor(
    private readonly repository: CartRepository,
    private readonly catalog: ProductCatalog,
  ) {}

  public get(userId: string) {
    return this.repository.getOrCreate(userId);
  }

  public async add(userId: string, productId: string, quantity: number) {
    assertQuantity(quantity);
    if (!(await this.catalog.exists(productId))) {
      throw new AppError('Product was not found.', 404, 'PRODUCT_NOT_FOUND');
    }
    return this.repository.add(userId, productId, quantity);
  }

  public setQuantity(userId: string, productId: string, quantity: number) {
    assertQuantity(quantity);
    return this.repository.setQuantity(userId, productId, quantity);
  }

  public remove(userId: string, productId: string) {
    return this.repository.remove(userId, productId);
  }
}
