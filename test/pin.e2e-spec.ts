import { gql } from 'apollo-server-core';
import { Powers } from '../src/components/authorization/dto/powers';
import {
  createPin,
  createProject,
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  TestApp,
} from './utility';

describe('Pin e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateProject,
      Powers.CreateFieldZone,
      Powers.CreateFieldRegion,
    ]);
  });

  afterAll(async () => {
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
