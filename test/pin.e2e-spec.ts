import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import {
  createPin,
  createProject,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';

describe('Pin e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUser(app);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('should pin project', async () => {
    const project = await createProject(app);
    expect(project.pinned).toBe(false);

    await createPin(app, project.id, true);
    const result = await app.graphql.query(
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

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.pinned).toBe(true);
  });
});
