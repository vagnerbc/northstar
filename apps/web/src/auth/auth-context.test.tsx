import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const keycloakMock = vi.hoisted(() => {
  const client = {
    authenticated: false,
    init: vi.fn(() => Promise.resolve(false)),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    updateToken: vi.fn(),
  };

  return {
    client,
    constructor: vi.fn(function KeycloakMock() {
      return client;
    }),
  };
});

vi.mock('keycloak-js', () => ({ default: keycloakMock.constructor }));

import { AuthProvider, useAuth } from './auth-context';

function AuthState() {
  const auth = useAuth();
  return <span>{auth.ready ? 'ready' : 'initializing'}</span>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    keycloakMock.client.init.mockClear();
    keycloakMock.constructor.mockClear();
  });

  it('initializes Keycloak only once when React Strict Mode re-runs effects', async () => {
    render(
      <StrictMode>
        <AuthProvider>
          <AuthState />
        </AuthProvider>
      </StrictMode>,
    );

    await screen.findByText('ready');

    await waitFor(() => {
      expect(keycloakMock.constructor).toHaveBeenCalledTimes(1);
      expect(keycloakMock.client.init).toHaveBeenCalledTimes(1);
    });
  });
});
