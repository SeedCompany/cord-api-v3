import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { CalendarDate, isValidId } from '../../src/common';
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
import { SecuredList } from './sensitivity';

export async function readOneProjectOtherLocationsItems(
  app: TestApp,
  id: string
): Promise<SecuredList<Location>> {
  const result = await app.graphql.query(
    gql`
      query {
        project(id: "${id}") {
          ...project
        }
      }
      ${fragments.project}
    `
  );

  const actual = result.project.otherLocations.items;
  expect(actual).toBeTruthy();
  return actual;
}
export async function readOneProjectPrimaryLocation(
  app: TestApp,
  id: string
): Promise<SecuredList<Location>> {
  const result = await app.graphql.query(
    gql`
      query {
        project(id: "${id}") {
          ...project
        }
      }
      ${fragments.project}
    `
  );

  const actual = result.project.primaryLocation;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneProjectOtherLocations(
  app: TestApp,
  id: string
): Promise<SecuredList<Location>> {
  const result = await app.graphql.query(
    gql`
      query {
        project(id: "${id}") {
          ...project
        }
      }
      ${fragments.project}
    `
  );

  const actual = result.project.otherLocations;
  expect(actual).toBeTruthy();
  return actual;
}
export async function readOneProject(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query {
        project(id: "${id}") {
          ...project
        }
      }
      ${fragments.project}
    `
  );

  const actual = result.project;
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
    fieldRegionId: input.fieldRegionId || (await createRegion(app)).id,
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
