import Keycloak from 'keycloak-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface AuthContextValue {
  authenticated: boolean;
  ready: boolean;
  userName: string;
  getToken: () => Promise<string | undefined>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  register: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const keycloak = useRef<Keycloak | null>(null);
  const [ready, setReady] = useState(authDisabled);
  const [authenticated, setAuthenticated] = useState(authDisabled);

  useEffect(() => {
    if (authDisabled || keycloak.current) return;

    // React Strict Mode intentionally re-runs effects in development. Keeping the client in the
    // ref prevents two concurrent check-sso redirects and makes Keycloak initialization idempotent.
    const client = new Keycloak({
      url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
      realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'ecommerce',
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'ecommerce-web',
    });
    keycloak.current = client;
    void client
      .init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false })
      .then((value) => setAuthenticated(value))
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));
  }, []);

  const getToken = useCallback(async () => {
    if (authDisabled) return undefined;
    const client = keycloak.current;
    if (!client?.authenticated) return undefined;
    await client.updateToken(30);
    return client.token;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      authenticated,
      userName: authDisabled
        ? 'Demo Buyer'
        : ((keycloak.current?.tokenParsed?.preferred_username as string | undefined) ?? 'Buyer'),
      getToken,
      login: async () => {
        await keycloak.current?.login({ redirectUri: redirectUriWithoutAuthFragment() });
      },
      logout: async () => {
        await keycloak.current?.logout({ redirectUri: window.location.origin });
      },
      register: async () => {
        await keycloak.current?.register({ redirectUri: redirectUriWithoutAuthFragment() });
      },
    }),
    [authenticated, getToken, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function redirectUriWithoutAuthFragment(): string {
  const redirectUri = new URL(window.location.href);
  redirectUri.hash = '';
  return redirectUri.toString();
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
