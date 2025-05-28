import { faker } from '@faker-js/faker';
import { startCase } from 'lodash';
import { type ID } from '~/common';
import { SessionHost } from '~/core/authentication/session/session.host';
import { SessionManager } from '~/core/authentication/session/session.manager';
import { graphql } from '~/graphql';
import { FileService } from '../../src/components/file';
import { type TestApp } from './create-app';
import { fileNode } from './fragments';

export async function createRootDirectory(app: TestApp, name?: string) {
  name = name ?? startCase(faker.lorem.words());
  const session = await app
    .get(SessionManager)
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
    graphql(
      `
        mutation createDirectory($input: CreateDirectoryInput!) {
          createDirectory(input: $input) {
            ...fileNode
          }
        }
      `,
      [fileNode],
    ),
    {
      input,
    },
  );

  const actual = result.createDirectory;
  expect(actual).toBeTruthy();
  expect(actual.name).toBe(input.name);

  return actual;
}
