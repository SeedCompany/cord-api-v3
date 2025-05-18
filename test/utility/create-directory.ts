import { faker } from '@faker-js/faker';
import { startCase } from 'lodash';
import { type ID } from '~/common';
import { AuthenticationService } from '~/core/authentication/authentication.service';
import { SessionHost } from '~/core/authentication/session/session.host';
import { FileService } from '../../src/components/file';
import { type TestApp } from './create-app';
import { fileNode, type RawDirectory } from './fragments';
import { gql } from './gql-tag';

export async function createRootDirectory(app: TestApp, name?: string) {
  name = name ?? startCase(faker.lorem.words());
  const session = await app
    .get(AuthenticationService)
    .resumeSession(app.graphql.authToken);
  return await app.get(SessionHost).withSession(session, async () => {
    const id = await app.get(FileService).createRootDirectory({
      // An attachment point is required, so just use the current user.
      resource: { __typename: 'User', id: session.userId },
      relation: 'dir',
      name,
    });
    return await app.get(FileService).getDirectory(id);
  });
}

export async function createDirectory(
  app: TestApp,
  parentId: ID,
  name?: string,
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
    },
  );

  const actual: RawDirectory = result.createDirectory;
  expect(actual).toBeTruthy();
  expect(actual.name).toBe(input.name);

  return actual;
}
