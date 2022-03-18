import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { registerUser, runInIsolatedSession } from '.';
import {
  CalendarDate,
  isValidId,
  SecuredListType as SecuredList,
} from '../../src/common';
import { Role } from '../../src/components/authorization';
import { SecuredBudget } from '../../src/components/budget';
import { Location } from '../../src/components/location';
import {
  CreateProject,
  Project,
  ProjectStep,
  ProjectType,
} from '../../src/components/project';
import { TestApp } from './create-app';
import { createRegion } from './create-region';
import { fragments } from './fragments';
import { Raw } from './raw.type';

export async function listProjects(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        projects(input: {}) {
          items {
            ...project
          }
        }
      }
      ${fragments.project}
    `
  );
  const projects = result.projects.items;
  expect(projects).toBeTruthy();
  return projects;
}

export async function readOneProjectOtherLocationsItems(
  app: TestApp,
  id: string
) {
  return (await readOneProjectOtherLocations(app, id)).items;
}

export async function readOneProjectPrimaryLocation(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadProjectPrimaryLocation($id: ID!) {
        project(id: $id) {
          primaryLocation {
            canEdit
            canRead
            value {
              ...location
            }
          }
        }
      }
      ${fragments.location}
    `,
    { id }
  );

  const actual: Raw<SecuredList<Location>> = result.project.primaryLocation;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneProjectOtherLocations(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadProjectOtherLocations($id: ID!) {
        project(id: $id) {
          otherLocations {
            canRead
            canCreate
            total
            items {
              ...location
            }
          }
        }
      }
      ${fragments.location}
    `,
    { id }
  );

  const actual: SecuredList<Location> = result.project.otherLocations;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneProjectBudget(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadProjectBudget($id: ID!) {
        project(id: $id) {
          budget {
            canRead
            canEdit
            value {
              ...budget
            }
          }
        }
      }
      ${fragments.budget}
    `,
    { id }
  );

  const actual: { budget: SecuredBudget } = result.project;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneProject(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadProject($id: ID!) {
        project(id: $id) {
          ...project
        }
      }
      ${fragments.project}
    `,
    { id }
  );

  const actual: Raw<Project> = result.project;
  expect(actual).toBeTruthy();
  expect(actual.id).toEqual(id);
  return actual;
}

export async function createProject(
  app: TestApp,
  input: Partial<CreateProject> = {}
) {
  const project: CreateProject = {
    name: faker.random.word() + ' ' + faker.datatype.uuid(),
    type: ProjectType.Translation,
    mouStart: CalendarDate.fromISO('1991-01-01'),
    mouEnd: CalendarDate.fromISO('1992-01-01'),
    step: ProjectStep.EarlyConversations,
    tags: ['tag1', 'tag2'],
    fieldRegionId:
      input.fieldRegionId ||
      (await runInIsolatedSession(app, async () => {
        await registerUser(app, { roles: [Role.Administrator] }); // only admin role can create a region for now
        return (await createRegion(app)).id;
      })),
    presetInventory: true,
    ...input,
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

  const actual: Raw<Project> = result.createProject.project;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(project.name);
  expect(actual.type).toBe(project.type);

  return actual;
}
