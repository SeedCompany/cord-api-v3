import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { Project, ProjectType } from '../src/components/project';
import {
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';
import { createProject } from './utility/create-project';

describe('Project e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it.only('create & read project by id', async () => {
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
    try {
      await app.graphql.query(
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
    } catch (e) {
      expect(e.response.statusCode).toBe(404);
    }
  });

  it('List view of projects', async () => {
    // create 10 projects
    const numProjects = 10;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(() =>
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
  });
});
