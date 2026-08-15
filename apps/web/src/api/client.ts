import type {
  Cart,
  CheckoutAccepted,
  Order,
  Page,
  PaymentSession,
  Product,
  ShippingAddress,
} from '../types';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  getToken: () => Promise<string | undefined>,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(import.meta.env.VITE_AUTH_DISABLED === 'true'
        ? { 'x-test-user-id': 'local-demo-user', 'x-test-user-email': 'buyer@example.com' }
        : {}),
      ...init?.headers,
    },
  });
  const correlationId = response.headers.get('x-correlation-id') ?? undefined;
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({ detail: response.statusText }))) as {
      detail?: string;
      title?: string;
    };
    throw new ApiError(
      problem.detail ?? problem.title ?? 'The request failed.',
      response.status,
      correlationId,
    );
  }
  return response.json() as Promise<T>;
}

export const api = {
  products: (getToken: () => Promise<string | undefined>, cursor?: string) =>
    request<Page<Product>>(
      `/api/v1/products?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      getToken,
    ),
  product: (id: string, getToken: () => Promise<string | undefined>) =>
    request<Product>(`/api/v1/products/${id}`, getToken),
  cart: (getToken: () => Promise<string | undefined>) => request<Cart>('/api/v1/cart', getToken),
  addCartItem: (productId: string, quantity: number, getToken: () => Promise<string | undefined>) =>
    request<Cart>('/api/v1/cart/items', getToken, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),
  setCartItem: (productId: string, quantity: number, getToken: () => Promise<string | undefined>) =>
    request<Cart>(`/api/v1/cart/items/${productId}`, getToken, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  removeCartItem: (productId: string, getToken: () => Promise<string | undefined>) =>
    request<Cart>(`/api/v1/cart/items/${productId}`, getToken, { method: 'DELETE' }),
  checkout: (
    shippingAddress: ShippingAddress,
    key: string,
    getToken: () => Promise<string | undefined>,
  ) =>
    request<CheckoutAccepted>('/api/v1/orders/checkout', getToken, {
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: JSON.stringify({ shippingAddress }),
    }),
  orders: (getToken: () => Promise<string | undefined>, cursor?: string) =>
    request<Page<Order>>(
      `/api/v1/orders?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      getToken,
    ),
  order: (id: string, getToken: () => Promise<string | undefined>) =>
    request<Order>(`/api/v1/orders/${id}`, getToken),
  paymentSession: (id: string, getToken: () => Promise<string | undefined>) =>
    request<PaymentSession>(`/api/v1/payments/${id}/session`, getToken),
  fakeAuthorize: (id: string, getToken: () => Promise<string | undefined>) =>
    request(`/api/v1/payments/${id}/fake/authorize`, getToken, { method: 'POST' }),
};
