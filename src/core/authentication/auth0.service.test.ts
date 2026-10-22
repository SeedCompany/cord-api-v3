import { describe, expect, it } from '@jest/globals';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from 'jose';
import { type ConfigService } from '~/core/config';
import { type ILogger } from '~/core/logger';
import { Auth0Service } from './auth0.service';

const domain = 'tenant.example.auth0.com';
const apiAudience = 'https://cord-api.example';

const setup = async (auth0: Partial<ConfigService['auth0']> = {}) => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const config = {
    auth0: { domain, audience: 'login-client', apiAudience, ...auth0 },
  } as unknown as ConfigService;
  const logger = { warning: () => undefined } as unknown as ILogger;
  const service = new Auth0Service(config, logger);
  // Swap the remote JWKS for a local key set so signatures are really checked.
  (service as unknown as { jwks: unknown }).jwks = createLocalJWKSet({
    keys: [jwk],
  });

  const sign = async (
    claims: JWTPayload,
    opts: { iss?: string; aud?: string; exp?: string | number } = {},
    key = privateKey,
  ) =>
    await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(opts.iss ?? `https://${domain}/`)
      .setAudience(opts.aud ?? apiAudience)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '5m')
      .sign(key);

  return { service, sign };
};

describe('Auth0Service access tokens', () => {
  it('accepts a valid token and reports sub, client, issued-at', async () => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'okta|abc', azp: 'claude-client' });
    const claims = await service.verifyAccessToken(token);
    expect(claims.sub).toBe('okta|abc');
    expect(claims.clientId).toBe('claude-client');
    expect(claims.issuedAt).toBeGreaterThan(0);
  });

  it('falls back to client_id when azp is absent', async () => {
    const { service, sign } = await setup();
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Auth0's claim name
    const token = await sign({ sub: 'okta|abc', client_id: 'other-client' });
    expect((await service.verifyAccessToken(token)).clientId).toBe(
      'other-client',
    );
  });

  it.each([
    [
      'wrong audience (e.g. an ID token for the login client)',
      { aud: 'login-client' },
    ],
    ['wrong issuer', { iss: 'https://evil.example/' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 600 }],
  ])('rejects %s', async (_name, opts) => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'okta|abc', azp: 'c' }, opts);
    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Invalid access token',
    );
  });

  it('rejects a token signed by a different key', async () => {
    const { service, sign } = await setup();
    const other = await generateKeyPair('RS256');
    const token = await sign(
      { sub: 'okta|abc', azp: 'c' },
      {},
      other.privateKey,
    );
    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Invalid access token',
    );
  });

  it('rejects a token it cannot attribute to a client application', async () => {
    const { service, sign } = await setup();
    const token = await sign({ sub: 'okta|abc' });
    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Invalid access token',
    );
  });

  it('rejects an unsigned (alg none) token', async () => {
    const { service } = await setup();
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none' })}.${b64({
      iss: `https://${domain}/`,
      aud: apiAudience,
      sub: 'x',
      azp: 'c',
      iat: 1,
      exp: 9999999999,
    })}.`;
    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Invalid access token',
    );
  });

  it('fails closed when the API audience is not configured', async () => {
    const { service, sign } = await setup({ apiAudience: undefined });
    const token = await sign({ sub: 'okta|abc', azp: 'c' });
    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Agent access is not configured',
    );
  });
});

describe('Auth0Service.isIssuedByAuth0 (routing only)', () => {
  it('recognizes our tenant, not Cord session tokens or garbage', async () => {
    const { service, sign } = await setup();
    expect(service.isIssuedByAuth0(await sign({ sub: 'x' }))).toBe(true);
    expect(
      service.isIssuedByAuth0(
        await sign({ sub: 'x' }, { iss: 'https://other/' }),
      ),
    ).toBe(false);
    // Cord's own session token shape: HS256 with just `iat`.
    expect(
      service.isIssuedByAuth0(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTIxNDk3NDEyNzV9.sig',
      ),
    ).toBe(false);
    expect(service.isIssuedByAuth0('not-a-jwt')).toBe(false);
  });

  it('is false when no tenant is configured', async () => {
    const { service, sign } = await setup({ domain: undefined });
    expect(service.isIssuedByAuth0(await sign({ sub: 'x' }))).toBe(false);
  });
});
