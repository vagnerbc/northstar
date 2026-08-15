import { createServiceTokenProvider } from '@ecommerce/auth';
import { AppError } from '@ecommerce/http';
import type { CartClient, CartSnapshot } from '../application/ports.js';
import { config } from './config.js';

const tokenProvider = createServiceTokenProvider({
  tokenEndpoint: `${config.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
  clientId: config.SERVICE_CLIENT_ID,
  clientSecret: config.SERVICE_CLIENT_SECRET,
  scope: config.SERVICE_CLIENT_SCOPE,
});

export class HttpCartClient implements CartClient {
  public async getSnapshot(userId: string, correlationId: string): Promise<CartSnapshot> {
    const headers: Record<string, string> = { 'x-correlation-id': correlationId };
    if (!config.AUTH_DISABLED) headers.authorization = `Bearer ${await tokenProvider()}`;
    const response = await fetch(
      `${config.CART_BASE_URL}/internal/v1/carts/${encodeURIComponent(userId)}`,
      { headers },
    );
    if (!response.ok) throw new AppError('Cart could not be loaded.', 502, 'CART_UNAVAILABLE');
    return response.json() as Promise<CartSnapshot>;
  }
}
