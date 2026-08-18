import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ProtocolMapper {
  name: string;
  protocolMapper: string;
  config: Record<string, string>;
}

interface RealmClient {
  clientId: string;
  protocolMappers?: ProtocolMapper[];
}

interface RealmConfiguration {
  clients: RealmClient[];
}

const realm = JSON.parse(
  readFileSync(new URL('../../../infra/keycloak/ecommerce-realm.json', import.meta.url), 'utf8'),
) as RealmConfiguration;

function client(clientId: string): RealmClient {
  const configuredClient = realm.clients.find((candidate) => candidate.clientId === clientId);
  if (!configuredClient) throw new Error(`Keycloak client ${clientId} is not configured.`);
  return configuredClient;
}

function mapper(clientId: string, name: string): ProtocolMapper {
  const configuredMapper = client(clientId).protocolMappers?.find(
    (candidate) => candidate.name === name,
  );
  if (!configuredMapper)
    throw new Error(`Keycloak mapper ${name} is not configured for ${clientId}.`);
  return configuredMapper;
}

describe('Keycloak realm authentication claims', () => {
  it('includes the user identity claims consumed by the web application and APIs', () => {
    expect(mapper('ecommerce-web', 'subject')).toMatchObject({
      protocolMapper: 'oidc-sub-mapper',
      config: { 'access.token.claim': 'true' },
    });
    expect(mapper('ecommerce-web', 'email')).toMatchObject({
      protocolMapper: 'oidc-usermodel-property-mapper',
      config: {
        'user.attribute': 'email',
        'claim.name': 'email',
        'access.token.claim': 'true',
      },
    });
    expect(mapper('ecommerce-web', 'preferred username')).toMatchObject({
      protocolMapper: 'oidc-usermodel-property-mapper',
      config: {
        'user.attribute': 'username',
        'claim.name': 'preferred_username',
        'access.token.claim': 'true',
      },
    });
  });

  it('includes a subject in internal service-account tokens', () => {
    expect(mapper('order-service', 'subject')).toMatchObject({
      protocolMapper: 'oidc-sub-mapper',
      config: { 'access.token.claim': 'true' },
    });
  });
});
