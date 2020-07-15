import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  createOrganization,
  createSession,
  createTestApp,
  createUser,
  TestApp,
} from './utility';
import { createPermission } from './utility/create-permission';
import { createProduct } from './utility/create-product';
import { createSecurityGroup } from './utility/create-security-group';
import { login } from './utility/login';

describe('Authorization e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    process.env = Object.assign(process.env, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_EMAIL: 'devops@tsco.org',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_PASSWORD: 'admin',
    });
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it.skip('create security group', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const sg = await createSecurityGroup(app);

    expect(sg.success).toBe(true);
  });

  it.skip('add property to security group', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const sg = await createSecurityGroup(app);
    const result = await app.graphql.mutate(
      gql`
        mutation addPropertyToSecurityGroup($sgId: ID!, $propName: String!) {
          addPropertyToSecurityGroup(
            input: { request: { sgId: $sgId, property: $propName } }
          )
        }
      `,
      {
        sgId: sg.id,
        propName: 'canCreateFile',
      }
    );
    expect(result.addPropertyToSecurityGroup).toBeTruthy();
  });

  it.skip('create permission', async () => {
    // create permission is a deprecated function  see note in authorization service
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

  it.skip('attach user to security group', async () => {
    const newUser = await createUser(app);
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });
    const sg = await createSecurityGroup(app);
    const result = await app.graphql.mutate(
      gql`
        mutation attachUserToSecurityGroup($sgId: ID!, $userId: ID!) {
          attachUserToSecurityGroup(
            input: { request: { sgId: $sgId, userId: $userId } }
          )
        }
      `,
      {
        sgId: sg.id,
        userId: newUser.id,
      }
    );

    expect(result.attachUserToSecurityGroup).toBe(true);
  });

  it.skip('remove permission from security group', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const sg = await createSecurityGroup(app);
    const project = await createProduct(app, {
      engagementId: '',
    });
    const permId = await createPermission(app, {
      sgId: sg.id!,
      baseNodeId: project.id,
      propertyName: 'name',
      read: true,
      write: true,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation removePermissionFromSecurityGroup(
          $id: ID!
          $sgId: ID!
          $baseNodeId: ID!
        ) {
          removePermissionFromSecurityGroup(
            input: {
              request: { id: $id, sgId: $sgId, baseNodeId: $baseNodeId }
            }
          )
        }
      `,
      {
        id: permId,
        sgId: sg.id,
        baseNodeId: project.id,
      }
    );

    expect(result.removePermissionFromSecurityGroup).toBe(true);
  });

  it.skip('remove user from security group', async () => {
    const newUser = await createUser(app);
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });
    const sg = await createSecurityGroup(app);

    // attach the user to the SG first
    await app.graphql.mutate(
      gql`
        mutation attachUserToSecurityGroup($sgId: ID!, $userId: ID!) {
          attachUserToSecurityGroup(
            input: { request: { sgId: $sgId, userId: $userId } }
          )
        }
      `,
      {
        sgId: sg.id,
        userId: newUser.id,
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation removeUserFromSecurityGroup($sgId: ID!, $userId: ID!) {
          removeUserFromSecurityGroup(
            input: { request: { sgId: $sgId, userId: $userId } }
          )
        }
      `,
      {
        sgId: sg.id,
        userId: newUser.id,
      }
    );

    expect(result.removeUserFromSecurityGroup).toBe(true);

    await expect(
      app.graphql.mutate(
        gql`
          mutation removeUserFromSecurityGroup($sgId: ID!, $userId: ID!) {
            removeUserFromSecurityGroup(
              input: { request: { sgId: $sgId, userId: $userId } }
            )
          }
        `,
        {
          sgId: sg.id,
          userId: newUser.id,
        }
      )
    ).rejects.toThrow();
  });

  it.skip('promote user to admin of security group', async () => {
    // there are no admins in security groups anymore.  there are admin security groups.
    const newUser = await createUser(app);
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });
    const sg = await createSecurityGroup(app);

    // attach the user to the SG first
    await app.graphql.mutate(
      gql`
        mutation attachUserToSecurityGroup($sgId: ID!, $userId: ID!) {
          attachUserToSecurityGroup(
            input: { request: { sgId: $sgId, userId: $userId } }
          )
        }
      `,
      {
        sgId: sg.id,
        userId: newUser.id,
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation promoteUserToAdminOfSecurityGroup($sgId: ID!, $userId: ID!) {
          promoteUserToAdminOfSecurityGroup(
            input: { request: { sgId: $sgId, userId: $userId } }
          )
        }
      `,
      {
        sgId: sg.id,
        userId: newUser.id,
      }
    );

    expect(result.promoteUserToAdminOfSecurityGroup).toBe(true);
  });

  it.skip('promote user to admin of base node', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const newUser = await createUser(app);
    const org = await createOrganization(app);

    const result = await app.graphql.mutate(
      gql`
        mutation promoteUserToAdminOfBaseNode($baseNodeId: ID!, $userId: ID!) {
          promoteUserToAdminOfBaseNode(
            input: { request: { baseNodeId: $baseNodeId, userId: $userId } }
          )
        }
      `,
      {
        baseNodeId: org.id,
        userId: newUser.id,
      }
    );

    expect(result.promoteUserToAdminOfBaseNode).toBe(true);
  });

  it.skip('delete security group', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });
    const sg = await createSecurityGroup(app);
    expect(sg.id).toBeTruthy();

    const result = await app.graphql.mutate(
      gql`
        mutation deleteSecurityGroup($id: ID!) {
          deleteSecurityGroup(id: $id)
        }
      `,
      {
        id: sg.id,
      }
    );

    expect(result.deleteSecurityGroup).toBe(true);
  });

  it.skip('update security group name', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const sg = await createSecurityGroup(app);

    const newName = faker.random.word();

    const result = await app.graphql.mutate(
      gql`
        mutation updateSecurityGroupName($id: ID!, $name: String!) {
          updateSecurityGroupName(
            input: { request: { id: $id, name: $name } }
          ) {
            id
            name
          }
        }
      `,
      {
        id: sg.id,
        name: newName,
      }
    );

    expect(result.updateSecurityGroupName.id).toBe(sg.id);
    expect(result.updateSecurityGroupName.name).toBe(newName);
  });
});
