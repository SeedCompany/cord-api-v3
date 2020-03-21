import {
  createOrganization,
  createSession,
  createTestApp,
  createUser,
  TestApp,
} from './utility';
import { createPermission } from './utility/create-permission';
import { createSecurityGroup } from './utility/create-security-group';
import { login } from './utility/login';

describe('Authorization e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    process.env = Object.assign(process.env, {
      ROOT_ADMIN_EMAIL: 'asdf@asdf.asdf',
      ROOT_ADMIN_PASSWORD: 'asdf',
    });
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // CREATE SG
  it('create security group', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const sg = await createSecurityGroup(app);

    expect(sg.success).toBe(true);
  });

  // CREATE SG
  it('create permission', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const sg = await createSecurityGroup(app);
    const org = await createOrganization(app);
    const perm = await createPermission(app, {
      sgId: sg.id!,
      baseNodeId: org.id,
      propertyName: 'name',
      read: true,
      write: true,
    });

    expect(perm).toBeTruthy();
  });
});
