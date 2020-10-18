import { gql } from 'apollo-server-core';
import { FieldRegion } from '../src/components/field-region';
import { FieldZone } from '../src/components/field-zone';
import { Location } from '../src/components/location';
import {
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createLocation,
  createProject,
  createRegion,
  createSession,
  createTestApp,
  createZone,
  fragments,
  getUserFromSession,
  registerUser,
  TestApp,
} from './utility';

describe('Project e2e', () => {
  let app: TestApp;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  let director: User;
  let fieldZone: FieldZone;
  let fieldRegion: FieldRegion;
  let location: Location;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await registerUser(app);
    fieldZone = await createZone(app, { directorId: director.id });
    fieldRegion = await createRegion(app, {
      directorId: director.id,
      fieldZoneId: fieldZone.id,
    });
    location = await createLocation(app);
    intern = await getUserFromSession(app);
    mentor = await getUserFromSession(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('should have project step', async () => {
    const project = await createProject(app);
    expect(project.step.value).toBe(ProjectStep.EarlyConversations);
  });

  it('should have project status', async () => {
    const project = await createProject(app);
    expect(project.status).toBe(ProjectStatus.InDevelopment);
  });

  it('Should have default status as Pending for first budget with project creation', async () => {
    const type = ProjectType.Translation;
    const project = await createProject(app, { type });

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            budget {
              value {
                id
                status
              }
              canRead
              canEdit
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );
    expect(queryProject.project.budget.value.status).toBe('Pending');
  });
});
