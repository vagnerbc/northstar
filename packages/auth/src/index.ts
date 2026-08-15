import { AppError, requestContext } from '@ecommerce/http';
import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload & { sub: string; email?: string; scope?: string };
    }
  }
}

export interface AuthMiddlewareOptions {
  issuer: string;
  jwksUrl?: string;
  audience?: string;
  requiredScopes?: string[];
}

export function createAuthMiddleware(options: AuthMiddlewareOptions): RequestHandler {
  const jwks = createRemoteJWKSet(
    new URL(
      options.jwksUrl ?? `${options.issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`,
    ),
  );

  return async (request, _response, next) => {
    try {
      const header = request.header('authorization');
      if (!header?.startsWith('Bearer ')) {
        throw new AppError('Authentication is required.', 401, 'AUTHENTICATION_REQUIRED');
      }

      const verificationOptions = options.audience
        ? { issuer: options.issuer, audience: options.audience }
        : { issuer: options.issuer };
      const { payload } = await jwtVerify(header.slice(7), jwks, verificationOptions);
      if (!payload.sub) {
        throw new AppError('The token has no subject.', 401, 'INVALID_TOKEN');
      }

      const scopes = new Set(typeof payload.scope === 'string' ? payload.scope.split(' ') : []);
      if (options.requiredScopes?.some((scope) => !scopes.has(scope))) {
        throw new AppError(
          'The token does not have the required scope.',
          403,
          'INSUFFICIENT_SCOPE',
        );
      }

      request.auth = payload as JWTPayload & { sub: string; email?: string; scope?: string };
      const context = requestContext.getStore();
      if (context) context.userId = payload.sub;
      next();
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError('The access token is invalid.', 401, 'INVALID_TOKEN'),
      );
    }
  };
}

export interface ServiceTokenProviderOptions {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

export function createServiceTokenProvider(options: ServiceTokenProviderOptions) {
  let cached: { token: string; expiresAt: number } | undefined;

  return async (): Promise<string> => {
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: options.clientId,
      client_secret: options.clientSecret,
      scope: options.scope,
    });
    const response = await fetch(options.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error(`Service token request failed with ${response.status}`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cached.token;
  };
}
