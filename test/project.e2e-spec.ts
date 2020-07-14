import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CalendarDate } from '../src/common';
import { Country, Region, Zone } from '../src/components/location';
import {
  CreateProject,
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  Role,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import { DatabaseService } from '../src/core';
import {
  createCountry,
  createInternshipEngagement,
  createLanguageEngagement,
  createPartnership,
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  createUser,
  createZone,
  expectNotFound,
  fragments,
  getUserFromSession,
  TestApp,
} from './utility';

describe('Project e2e', () => {
  let app: TestApp;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  let country: Country;
  let director: User;
  let zone: Zone;
  let region: Region;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await createUser(app);
    zone = await createZone(app, { directorId: director.id });
    region = await createRegion(app, {
      directorId: director.id,
      zoneId: zone.id,
    });
    country = await createCountry(app, { regionId: region.id });
    intern = await getUserFromSession(app);
    mentor = await getUserFromSession(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('should have unique name', async () => {
    const name = faker.random.word() + ' testProject';
    await createProject(app, { name });
    await expect(createProject(app, { name })).rejects.toThrowError();
  });

  it('should have project step', async () => {
    const project = await createProject(app);
    expect(project.step.value).toBe(ProjectStep.EarlyConversations);
  });

  it('should have project status', async () => {
    const project = await createProject(app);
    expect(project.status).toBe(ProjectStatus.InDevelopment);
  });

  it('create & read project by id', async () => {
    const project = await createProject(app);

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

    const actual: Project = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.type).toBe(project.type);
    expect(actual.sensitivity).toBe(project.sensitivity);
    expect(actual.name.value).toBe(project.name.value);
    expect(actual.deptId.value).toBe(project.deptId.value);
    expect(actual.step.value).toBe(project.step.value);
    expect(actual.status).toBe(project.status);
    expect(actual.mouStart.value).toBe(project.mouStart.value);
    expect(actual.mouEnd.value).toBe(project.mouEnd.value);
    expect(actual.estimatedSubmission.value).toBe(
      project.estimatedSubmission.value
    );
  });

  it('create project with required fields', async () => {
    const project: CreateProject = {
      name: faker.random.uuid(),
      type: ProjectType.Translation,
    };

    const result = await app.graphql.mutate(
      gql`
        mutation createProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project,
        },
      }
    );

    const actual: Project = result.createProject.project;
    expect(actual.id).toBeDefined();
    expect(actual.deptId.value).toBeNull();
    expect(actual.location.value).toBeNull();
    expect(actual.mouStart.value).toBeNull();
    expect(actual.mouEnd.value).toBeNull();
    expect(actual.estimatedSubmission.value).toBeNull();
  });

  it('create & read project with budget and location by id', async () => {
    const proj: CreateProject = {
      name: faker.random.uuid(),
      type: ProjectType.Translation,
      locationId: country.id,
    };

    const res = await app.graphql.mutate(
      gql`
        mutation createProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            project {
              ...project
              budget {
                value {
                  ...budget
                }
              }
              location {
                value {
                  id
                  name {
                    value
                  }
                }
              }
            }
          }
        }
        ${fragments.project}
        ${fragments.budget}
      `,
      {
        input: {
          project: proj,
        },
      }
    );
    const project = res.createProject.project;

    const result = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            budget {
              value {
                ...budget
              }
            }
            location {
              value {
                id
                name {
                  value
                }
              }
            }
          }
        }
        ${fragments.project}
        ${fragments.budget}
      `,
      {
        id: project.id,
      }
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.type).toBe(project.type);
    expect(actual.budget.value.id).toBe(project.budget.value.id);
    expect(actual.location.value.name.value).toBe(
      project.location.value.name.value
    );
  });

  it('update project', async () => {
    const project = await createProject(app);
    const namenew = faker.random.word() + ' Project';

    const result = await app.graphql.query(
      gql`
        mutation updateProject($id: ID!, $name: String!) {
          updateProject(input: { project: { id: $id, name: $name } }) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
        name: namenew,
      }
    );

    expect(result.updateProject.project.id).toBe(project.id);
    expect(result.updateProject.project.name.value).toBe(namenew);
  });

  it('delete project', async () => {
    const project = await createProject(app);
    expect(project.id).toBeTruthy();
    const result = await app.graphql.mutate(
      gql`
        mutation deleteProject($id: ID!) {
          deleteProject(id: $id)
        }
      `,
      {
        id: project.id,
      }
    );

    const actual: boolean | undefined = result.deleteProject;
    expect(actual).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
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
      )
    );
  });

  it('List view of projects', async () => {
    // create 2 projects
    const numProjects = 2;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(async () =>
        createProject(app, {
          type,
        })
      )
    );

    const { projects } = await app.graphql.query(
      gql`
        query projects($type: ProjectType!) {
          projects(input: { filter: { type: $type } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `,
      {
        type,
      }
    );
    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);

    //delete all projects
    await Promise.all(
      projects.items.map(async (item: { id: any }) => {
        return app.graphql.mutate(
          gql`
            mutation deleteProject($id: ID!) {
              deleteProject(id: $id)
            }
          `,
          {
            id: item.id,
          }
        );
      })
    );
  });

  it('List view of my projects', async () => {
    const numProjects = 2;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(async () =>
        createProject(app, {
          type,
        })
      )
    );

    const { projects } = await app.graphql.query(
      gql`
        query projects {
          projects(input: { filter: { mine: true } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `
    );

    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);
    //delete all projects
    await Promise.all(
      projects.items.map(async (item: { id: any }) => {
        return app.graphql.mutate(
          gql`
            mutation deleteProject($id: ID!) {
              deleteProject(id: $id)
            }
          `,
          {
            id: item.id,
          }
        );
      })
    );
  });

  it.skip('returns false when consistency check shows multiple location nodes connected', async () => {
    const zone = await createZone(app);

    const region = await createRegion(app, {
      name: 'asia' + generate(),
      zoneId: zone.id,
      directorId: zone.director.value?.id,
    });

    const country = await createCountry(app, {
      name: 'India' + generate(),
      regionId: region.id,
    });

    const country2 = await createCountry(app, {
      name: 'India 2' + generate(),
      regionId: region.id,
    });

    const project = await createProject(app, {
      locationId: country.id,
      mouStart: DateTime.local(),
      mouEnd: DateTime.local(),
      estimatedSubmission: CalendarDate.fromSeconds(1),
    });

    const result = await app.graphql.query(
      gql`
        query {
          checkProjectConsistency
        }
      `
    );
    expect(result.checkProjectConsistency).toBeTruthy();
    const dbService = app.get(DatabaseService);
    // attach additionnal location relation btw project and country
    await dbService
      .query()
      .raw(
        `
        MATCH (p:Project {id: "${project.id}"}), (c:Country {id: "${country2.id}"})
        CREATE (p)-[:location {active: true}]->(c)
        `
      )
      .run();
    const testResult = await app.graphql.query(
      gql`
        query {
          checkProjectConsistency
        }
      `
    );
    expect(testResult.checkProjectConsistency).toBeFalsy();

    // delete project so next test will pass
    await app.graphql.mutate(
      gql`
        mutation deleteProject($id: ID!) {
          deleteProject(id: $id)
        }
      `,
      {
        id: project.id,
      }
    );
  });

  it('List view of language engagement', async () => {
    // create 1 engagementsin a project
    const numEngagements = 1;
    //const type = ProjectType.Translation;
    const project = await createProject(app);
    await createLanguageEngagement(app, {
      projectId: project.id,
    });

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            engagements {
              items {
                ...languageEngagement
              }
              hasMore
              total
            }
          }
        }
        ${fragments.project},
        ${fragments.languageEngagement}
      `,
      {
        id: project.id,
      }
    );
    expect(
      queryProject.project.engagements.items.length
    ).toBeGreaterThanOrEqual(numEngagements);
  });

  it('List view of internship engagement', async () => {
    //create 1 engagements in a project
    const numEngagements = 1;
    const type = ProjectType.Internship;
    const project = await createProject(app, { type });

    await createInternshipEngagement(app, {
      mentorId: mentor.id,
      projectId: project.id,
      internId: intern.id,
      countryOfOriginId: country.id,
    });
    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            engagements {
              items {
                ...internshipEngagement
              }
              hasMore
              total
            }
          }
        }
        ${fragments.project},
        ${fragments.internshipEngagement}
      `,
      {
        id: project.id,
      }
    );
    expect(
      queryProject.project.engagements.items.length
    ).toBeGreaterThanOrEqual(numEngagements);
  });

  it('DB constraint for project.name uniqueness', async () => {
    const projName = 'Fix the world ' + DateTime.local().toString();
    const project = await createProject(app, { name: projName });
    await expect(createProject(app, { name: projName })).rejects.toThrowError();

    //clean up
    await app.graphql.mutate(
      gql`
        mutation deleteProject($id: ID!) {
          deleteProject(id: $id)
        }
      `,
      {
        id: project.id,
      }
    );
  });

  it('List view of project members by projectId', async () => {
    //create 2 Project member
    const numProjectMembers = 2;
    const user = await createUser(app);
    const project = await createProject(app);
    const userId = user.id;
    const projectId = project.id;

    await Promise.all(
      times(numProjectMembers).map(() =>
        createProjectMember(app, {
          userId,
          projectId,
          roles: [Role.Consultant],
        })
      )
    );

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            team {
              items {
                ...projectMember
              }
              hasMore
              total
            }
          }
        }
        ${fragments.project},
        ${fragments.projectMember}
      `,
      {
        id: project.id,
      }
    );
    // Remember the project Owner is also a team member so that should be +1
    expect(queryProject.project.team.items.length).toBe(numProjectMembers + 1);
    expect(queryProject.project.team.total).toBe(numProjectMembers + 1);
  });

  it.skip('List view of partnerships by projectId', async () => {
    //create 2 partnerships in a project
    const numPartnerships = 2;
    const type = ProjectType.Translation;
    const project = await createProject(app, { type });

    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          projectId: project.id,
        })
      )
    );

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            partnerships {
              items {
                ...partnership
              }
              hasMore
              total
            }
          }
        }
        ${fragments.project},
        ${fragments.partnership}
      `,
      {
        id: project.id,
      }
    );

    expect(
      queryProject.project.partnerships.items.length
    ).toBeGreaterThanOrEqual(numPartnerships);
    expect(queryProject.project.partnerships.total).toBe(numPartnerships);
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

  it('Should have status as Current for budget with project update to active', async () => {
    const project = await createProject(app);
    const namenew = faker.random.word() + ' Project';

    const result = await app.graphql.query(
      gql`
        mutation updateProject($id: ID!, $name: String!) {
          updateProject(input: { project: { id: $id, name: $name } }) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
        name: namenew,
      }
    );

    expect(result.updateProject.project.id).toBe(project.id);
    expect(result.updateProject.project.name.value).toBe(namenew);

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
    expect(queryProject.project.budget.value.status).toBe('Current');
  });
});
