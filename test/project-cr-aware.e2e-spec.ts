import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { Powers } from '../src/components/authorization/dto/powers';
import { Role } from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createPlanChange,
  createProject,
  createSession,
  createTestApp,
  login,
  registerUserWithPower,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';
import { resetDatabase } from './utility/reset-database';

describe('Project CR Aware e2e', () => {
  let app: TestApp;
  let director: User;
  let db: Connection;
  const password = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);

    director = await registerUserWithPower(app, [Powers.DeleteProject], {
      roles: [Role.ProjectManager],
      password: password,
    });

    await login(app, { email: director.email.value, password });
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('CR aware project name', async () => {
    const project = await createProject(app);
    const planChange = await createPlanChange(app, {
      projectId: project.id,
    });
    expect(planChange.id).toBeTruthy();

    // Update project with changeId
    const newCRName = faker.random.word() + ' ' + faker.datatype.uuid();
    await app.graphql.query(
      gql`
        mutation updateProject($input: UpdateProjectInput!) {
          updateProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project: {
            id: project.id,
            name: newCRName,
          },
          changeId: planChange.id,
        },
      }
    );
    // Query project without changeId
    let result = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );
    expect(result.project.name.value).toBe(project.name.value);
    // Query project with changeId
    result = await app.graphql.query(
      gql`
        query project($id: ID!, $changeId: ID!) {
          project(id: $id, changeId: $changeId) {
            ...project
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
        changeId: planChange.id,
      }
    );
    expect(result.project.name.value).toBe(newCRName);
  });
});
