import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { UnauthenticatedException } from '~/common';
import {
  type Auth0Claims,
  Auth0Service,
} from '~/core/authentication/auth0.service';
import { ConfigService } from '~/core/config';
import { graphql } from '~/graphql';
import { loginWithAuth0, logout } from './operations/auth';
import { createApp, createTester, getRootTester, type TestApp } from './setup';
import { createExecute } from './setup/gql-client/gql-execute';

/**
 * Assistant (MCP) access: an Auth0 access token presented as a bearer token.
 * Signature/audience checking is covered with real keys in
 * auth0.service.test.ts; here `Auth0Service` is stubbed so the tokens are
 * just labels, and what's under test is how Cord turns a verified token into
 * a session.
 */
describe('Agent access via Auth0 access token e2e', () => {
  let app: TestApp;
  let url: string;

  /** token label -> verified claims, or undefined if verification should fail */
  const verified = new Map<
    string,
    { sub: string; clientId: string; issuedAt: number }
  >();
  const AGENT_PREFIX = 'agent:';

  beforeAll(async () => {
    app = await createApp();
    url = app.get(ConfigService).hostUrl$.value + 'graphql';
    const auth0 = app.get(Auth0Service);
    jest
      .spyOn(auth0, 'isIssuedByAuth0')
      .mockImplementation((token) => token.startsWith(AGENT_PREFIX));
    jest.spyOn(auth0, 'verifyAccessToken').mockImplementation((token) => {
      const claims = verified.get(token);
      return claims
        ? Promise.resolve(claims)
        : Promise.reject(new UnauthenticatedException('Invalid access token'));
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const agentRunner = (token: string, headers: Record<string, string> = {}) =>
    createExecute({
      url,
      headers: { authorization: `Bearer ${token}`, ...headers },
    });

  /** A real user with a linked Auth0 `sub`, made through the login path. */
  const linkedUser = async () => {
    const email = faker.internet.email();
    const sub = `okta|${faker.string.uuid()}`;
    const claims: Auth0Claims = {
      sub,
      email,
      emailVerified: true,
      givenName: faker.person.firstName(),
      familyName: faker.person.lastName(),
    };
    const tester = createTester(app);
    jest
      .spyOn(app.get(Auth0Service), 'verifyToken')
      .mockResolvedValueOnce(claims);
    const res = await tester.apply(loginWithAuth0({ idToken: 'seed-token' }));
    await tester.apply(logout());
    return { id: res.user.id, sub, email };
  };

  const issue = (sub: string, clientId = 'claude-desktop') => {
    const token = `${AGENT_PREFIX}${faker.string.uuid()}`;
    verified.set(token, {
      sub,
      clientId,
      issuedAt: Math.floor(Date.now() / 1000),
    });
    return token;
  };

  it('resolves the linked user from the access token', async () => {
    const user = await linkedUser();
    const run = agentRunner(issue(user.sub));

    const res = await run(WhoAmI);
    expect(res.session.user?.id).toBe(user.id);
  });

  it('does not create a stored session for it', async () => {
    const user = await linkedUser();
    const run = agentRunner(issue(user.sub));
    const res = await run(WhoAmI);
    // A stored session would hand back a token we could reuse as a Cord one.
    expect(res.session.token).toBeNull();
  });

  it('refuses a sub that is not linked to any Cord user (no JIT, no email match)', async () => {
    const run = agentRunner(issue(`okta|${faker.string.uuid()}`));
    await expect(run(WhoAmI)).rejects.toThrowGqlError({
      code: ['Unauthenticated', 'Authentication', 'Client'],
      message: expect.stringContaining('Sign in to Cord Field once first'),
    });
  });

  it('refuses a token that fails verification', async () => {
    const run = agentRunner(`${AGENT_PREFIX}never-issued`);
    await expect(run(WhoAmI)).rejects.toThrowGqlError({
      code: ['Unauthenticated', 'Authentication', 'Client'],
    });
  });

  it('refuses a disabled user', async () => {
    const admin = await getRootTester(app);
    const user = await linkedUser();
    await admin.run(DisableUser, { id: user.id });

    const run = agentRunner(issue(user.sub));
    await expect(run(WhoAmI)).rejects.toThrowGqlError({
      message: 'User is disabled',
    });
  });

  it('is read-only: mutations are refused', async () => {
    const user = await linkedUser();
    const run = agentRunner(issue(user.sub));
    await expect(run(PinSomething, { id: user.id })).rejects.toThrowGqlError({
      message: 'Agent access tokens are read-only',
    });
  });

  it('refuses impersonation on top of an agent token', async () => {
    const user = await linkedUser();
    const other = await linkedUser();
    const run = agentRunner(issue(user.sub), {
      'x-cord-impersonate-user': other.id,
    });
    await expect(run(WhoAmI)).rejects.toThrowGqlError({
      message: 'Impersonation is not available with agent access tokens',
    });
  });

  it('refuses a cookie session for an agent token', async () => {
    const user = await linkedUser();
    const run = agentRunner(issue(user.sub));
    await expect(run(BrowserSession)).rejects.toThrowGqlError({
      message: 'Cookie sessions are not available with agent access tokens',
    });
  });

  it('leaves Cord’s own session tokens working as before', async () => {
    const tester = createTester(app);
    const user = await linkedUser();
    jest.spyOn(app.get(Auth0Service), 'verifyToken').mockResolvedValueOnce({
      sub: user.sub,
      email: user.email,
      emailVerified: true,
    });
    const login = await tester.apply(loginWithAuth0({ idToken: 'x' }));
    expect(login.user.id).toBe(user.id);
    const who = await tester.run(WhoAmI);
    expect(who.session.user?.id).toBe(user.id);
  });
});

const WhoAmI = graphql(`
  query AgentWhoAmI {
    session {
      token
      user {
        id
      }
    }
  }
`);

const BrowserSession = graphql(`
  query AgentBrowserSession {
    session(browser: true) {
      __typename
    }
  }
`);

const PinSomething = graphql(`
  mutation AgentTryWrite($id: ID!) {
    togglePinned(id: $id, pinned: true)
  }
`);

const DisableUser = graphql(`
  mutation DisableUserForAgentSpec($id: ID!) {
    updateUser(input: { id: $id, status: Disabled }) {
      __typename
    }
  }
`);
