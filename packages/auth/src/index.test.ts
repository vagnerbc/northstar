import type { Request, Response as ExpressResponse } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware, createServiceTokenProvider } from './index.js';

afterEach(() => vi.unstubAllGlobals());

describe('authentication helpers', () => {
  it('rejects a request without a bearer token before any JWKS lookup', async () => {
    const middleware = createAuthMiddleware({ issuer: 'http://identity.test/realms/ecommerce' });
    const next = vi.fn();

    await middleware(
      { header: vi.fn().mockReturnValue(undefined) } as unknown as Request,
      {} as ExpressResponse,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED', status: 401 }),
    );
  });

  it('caches service credentials until shortly before token expiry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'service-token', expires_in: 300 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const token = createServiceTokenProvider({
      tokenEndpoint: 'http://identity.test/token',
      clientId: 'order-service',
      clientSecret: 'secret',
      scope: 'cart:read',
    });

    await expect(token()).resolves.toBe('service-token');
    await expect(token()).resolves.toBe('service-token');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not hide a failed client-credentials exchange', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const token = createServiceTokenProvider({
      tokenEndpoint: 'http://identity.test/token',
      clientId: 'order-service',
      clientSecret: 'wrong',
      scope: 'payment:write',
    });

    await expect(token()).rejects.toThrow('Service token request failed with 401');
  });
});
