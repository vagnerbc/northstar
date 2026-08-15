import { describe, expect, it, vi } from 'vitest';
import { CartApplication } from './cart.js';
import type { CartRepository, ProductCatalog } from './ports.js';

const cart = {
  id: crypto.randomUUID(),
  userId: 'buyer',
  version: 1,
  items: [{ productId: crypto.randomUUID(), quantity: 2 }],
  updatedAt: new Date(),
};

function createRepository(): CartRepository {
  return {
    getOrCreate: vi.fn().mockResolvedValue(cart),
    add: vi.fn().mockResolvedValue(cart),
    setQuantity: vi.fn().mockResolvedValue(cart),
    remove: vi.fn().mockResolvedValue(cart),
    removePurchased: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockResolvedValue(true),
  };
}

describe('CartApplication', () => {
  it('does not add a product that is outside the catalog', async () => {
    const repository = createRepository();
    const catalog: ProductCatalog = { exists: async () => false };
    const application = new CartApplication(repository, catalog);
    await expect(application.add('buyer', crypto.randomUUID(), 1)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    });
  });

  it('supports the complete cart mutation lifecycle', async () => {
    const repository = createRepository();
    const catalog: ProductCatalog = { exists: vi.fn().mockResolvedValue(true) };
    const application = new CartApplication(repository, catalog);
    const productId = crypto.randomUUID();

    await expect(application.get('buyer')).resolves.toEqual(cart);
    await expect(application.add('buyer', productId, 2)).resolves.toEqual(cart);
    await expect(application.setQuantity('buyer', productId, 3)).resolves.toEqual(cart);
    await expect(application.remove('buyer', productId)).resolves.toEqual(cart);

    expect(repository.add).toHaveBeenCalledWith('buyer', productId, 2);
    expect(repository.setQuantity).toHaveBeenCalledWith('buyer', productId, 3);
    expect(repository.remove).toHaveBeenCalledWith('buyer', productId);
  });

  it.each([0, 100, 1.5])('rejects invalid quantity %s', async (quantity) => {
    const repository = createRepository();
    const application = new CartApplication(repository, { exists: async () => true });

    await expect(application.add('buyer', crypto.randomUUID(), quantity)).rejects.toMatchObject({
      code: 'INVALID_QUANTITY',
    });
    expect(repository.add).not.toHaveBeenCalled();
  });
});
