import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogApplication } from './catalog.js';
import type { CatalogRepository } from './ports.js';
import type { InventoryReservation, Product } from '../domain/product.js';

const product: Product = {
  id: crypto.randomUUID(),
  sku: 'KEYBOARD-01',
  name: 'Mechanical Keyboard',
  description: 'A test product',
  imageUrl: '/keyboard.svg',
  priceAmount: 12_900,
  currency: 'BRL',
  availableQuantity: 5,
};

const reservation: InventoryReservation = {
  id: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  status: 'ACTIVE',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  items: [{ ...product, productId: product.id, quantity: 1, unitPriceAmount: product.priceAmount }],
};

function createRepository(): CatalogRepository {
  return {
    list: vi.fn().mockResolvedValue({ items: [product] }),
    findById: vi.fn().mockResolvedValue(product),
    reserve: vi.fn().mockResolvedValue(reservation),
    commit: vi.fn().mockResolvedValue({ ...reservation, status: 'COMMITTED' }),
    release: vi.fn().mockResolvedValue({ ...reservation, status: 'RELEASED' }),
    isReady: vi.fn().mockResolvedValue(true),
  };
}

describe('CatalogApplication', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('refuses an empty inventory reservation before calling persistence', async () => {
    const repository = createRepository();
    const application = new CatalogApplication(repository, 900_000);
    await expect(
      application.reserve(crypto.randomUUID(), [], crypto.randomUUID()),
    ).rejects.toMatchObject({
      code: 'EMPTY_RESERVATION',
    });
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it('delegates product reads and reservation lifecycle operations', async () => {
    const repository = createRepository();
    const application = new CatalogApplication(repository, 900_000);
    const orderId = crypto.randomUUID();

    await expect(application.list(undefined, 20)).resolves.toEqual({ items: [product] });
    await expect(application.get(product.id)).resolves.toEqual(product);
    await application.reserve(orderId, [{ productId: product.id, quantity: 1 }], 'correlation');
    await application.commit(orderId, 'correlation');
    await application.release(orderId, 'correlation');

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ orderId, correlationId: 'correlation' }),
    );
    expect(repository.commit).toHaveBeenCalledWith(orderId, 'correlation');
    expect(repository.release).toHaveBeenCalledWith(orderId, 'correlation');
  });

  it('hides whether a missing product ever existed', async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(null);
    const application = new CatalogApplication(repository, 900_000);

    await expect(application.get(product.id)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      status: 404,
    });
  });
});
