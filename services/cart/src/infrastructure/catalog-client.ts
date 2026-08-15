import type { ProductCatalog } from '../application/ports.js';

export class HttpProductCatalog implements ProductCatalog {
  public constructor(private readonly baseUrl: string) {}

  public async exists(productId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/v1/products/${productId}`);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
    return true;
  }
}
