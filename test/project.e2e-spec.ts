import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CalendarDate } from '../src/common';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import { DatabaseService } from '../src/core';
import {
  createCountry,
  createInternshipEngagement,
  createLanguageEngagement,
  createProject,
  createRegion,
  createSession,
  createTestApp,
  createUser,
  createZone,
  expectNotFound,
  fragments,
  TestApp,
} from './utility';

describe('Project e2e', () => {
  let app: TestApp;
  let intern: User;
  let mentor: User;

  beforeAll(async () => {
    jest.setTimeout(300000);
    app = await createTestApp();
    await createSession(app);
    intern = await createUser(app);
    mentor = await createUser(app);
    await createUser(app);
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
    expect(actual.modifiedAt).toBeTruthy();
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
    // create 10 projects
    const numProjects = 10;
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
    const numProjects = 3;
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
    // create 2 engagements in a project
    const numEngagements = 1; //2
    //const type = ProjectType.Translation;
    const project = await createProject(app);
    await createLanguageEngagement(app, {
      projectId: project.id,
    });

    // await createLanguageEngagement(app, {
    //   projectId: project.id,
    // });
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
    //console.log('queryProject ', JSON.stringify(queryProject, null, 2));
    expect(
      queryProject.project.engagements.items.length
    ).toBeGreaterThanOrEqual(numEngagements);
  });

  it('List view of internship engagement', async () => {
    // create 2 engagements in a project
    const numEngagements = 1; //2
    const type = ProjectType.Internship;
    const country = await createCountry(app);
    const project = await createProject(app, { type });

    await createInternshipEngagement(app, {
      mentorId: mentor.id,
      projectId: project.id,
      internId: intern.id,
      countryOfOriginId: country.id,
    });
    // await createLanguageEngagement(app, {
    //   projectId: project.id,
    // });

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
    //console.log('queryProject ', JSON.stringify(queryProject, null, 2));
    expect(
      queryProject.project.engagements.items.length
    ).toBeGreaterThanOrEqual(numEngagements);
  });
});
