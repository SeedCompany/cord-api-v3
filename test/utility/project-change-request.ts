import { faker } from '@faker-js/faker';
import { gql } from 'graphql-tag';
import { ID, isValidId } from '../../src/common';
import {
  CreateProjectChangeRequest,
  ProjectChangeRequest,
  ProjectChangeRequestType,
} from '../../src/components/project-change-request/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createProjectChangeRequest(
  app: TestApp,
  input: Partial<CreateProjectChangeRequest>
) {
  const changeRequest: CreateProjectChangeRequest = {
    projectId: input.projectId!, // Project status should be Active
    types: [ProjectChangeRequestType.Other],
    summary: faker.random.alpha(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation CreateProjectChangeRequest(
        $input: CreateProjectChangeRequestInput!
      ) {
        createProjectChangeRequest(input: $input) {
          projectChangeRequest {
            ...projectChangeRequest
          }
        }
      }
      ${fragments.projectChangeRequest}
    `,
    {
      input: {
        projectChangeRequest: changeRequest,
      },
    }
  );

  const actual: ProjectChangeRequest =
    result.createProjectChangeRequest.projectChangeRequest;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

export async function approveProjectChangeRequest(app: TestApp, id: ID) {
  const result = await app.graphql.mutate(
    gql`
      mutation ApproveProjectChangeRequest($id: ID!) {
        updateProjectChangeRequest(
          input: { projectChangeRequest: { id: $id, status: Approved } }
        ) {
          projectChangeRequest {
            ...projectChangeRequest
          }
        }
      }
      ${fragments.projectChangeRequest}
    `,
    {
      id,
    }
  );

  const actual: ProjectChangeRequest =
    result.updateProjectChangeRequest.projectChangeRequest;
  expect(actual).toBeTruthy();

  return actual;
}
