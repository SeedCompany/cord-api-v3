import { faker } from '@faker-js/faker';
import { startCase } from 'lodash';
import { ID } from '../../src/common';
import { loggedInSession } from '../../src/common/session';
import { AuthenticationService } from '../../src/components/authentication';
import { FileService } from '../../src/components/file';
import { TestApp } from './create-app';
import { fileNode, RawDirectory } from './fragments';
import { gql } from './gql-tag';

export async function createRootDirectory(app: TestApp, name?: string) {
  name = name ?? startCase(faker.lorem.words());
  const rawSession = await app
    .get(AuthenticationService)
    .resumeSession(app.graphql.authToken);
  const session = loggedInSession(rawSession);
  const actual = await app
    .get(FileService)
    .createDirectory(undefined, name, session);

  expect(actual).toBeTruthy();
  expect(actual.name).toBe(name);

  return actual;
}

export async function createDirectory(
  app: TestApp,
  parentId: ID,
  name?: string
) {
  const input = {
    parentId,
    name: name ?? startCase(faker.lorem.words()),
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createDirectory($input: CreateDirectoryInput!) {
        createDirectory(input: $input) {
          ...fileNode
        }
      }
      ${fileNode}
    `,
    {
      input,
    }
  );

  const actual: RawDirectory = result.createDirectory;
  expect(actual).toBeTruthy();
  expect(actual.name).toBe(input.name);

  return actual;
}
