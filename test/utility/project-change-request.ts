import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { type SetOptional } from 'type-fest';
import { type ID, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createProjectChangeRequest(
  app: TestApp,
  input: SetOptional<
    InputOf<typeof CreateChangeRequestDoc>,
    'types' | 'summary'
  >,
) {
  const result = await app.graphql.mutate(CreateChangeRequestDoc, {
    input: {
      types: ['Other'],
      summary: faker.string.alpha(),
      ...input,
    },
  });

  const actual = result.createProjectChangeRequest.projectChangeRequest;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
const CreateChangeRequestDoc = graphql(
  `
    mutation CreateProjectChangeRequest($input: CreateProjectChangeRequest!) {
      createProjectChangeRequest(input: { projectChangeRequest: $input }) {
        projectChangeRequest {
          ...projectChangeRequest
        }
      }
    }
  `,
  [fragments.projectChangeRequest],
);

export async function approveProjectChangeRequest(app: TestApp, id: ID) {
  const result = await app.graphql.mutate(ApproveProjectChangeRequestDoc, {
    id,
  });

  const actual = result.updateProjectChangeRequest.projectChangeRequest;
  expect(actual).toBeTruthy();

  return actual;
}
const ApproveProjectChangeRequestDoc = graphql(
  `
    mutation ApproveProjectChangeRequest($id: ID!) {
      updateProjectChangeRequest(
        input: { projectChangeRequest: { id: $id, status: Approved } }
      ) {
        projectChangeRequest {
          ...projectChangeRequest
        }
      }
    }
  `,
  [fragments.projectChangeRequest],
);
