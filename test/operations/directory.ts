import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { Case } from '@seedcompany/common/case';
import type { ID } from '~/common';
import { Identity } from '~/core/authentication';
import { graphql } from '~/graphql';
import { FileService } from '../../src/components/file';
import { type Tester } from '../setup';
import { fileNode } from '../utility/fragments';

/**
 * This functionality is not exposed externally, so we access the app
 * directly to execute.
 * This should just be used for setting up test data.
 */
export const createRootDirectory =
  (nameIn?: string) => async (tester: Tester & { identity: { id: ID } }) => {
    const name = nameIn ?? Case.capital(faker.lorem.words());
    const { identity, app } = tester;
    return await app.get(Identity).asUser(identity.id, async () => {
      const files = app.get(FileService);
      const dirId = await files.createRootDirectory({
        // An attachment point is required, so just use the current user.
        resource: { __typename: 'User', id: identity.id },
        relation: 'dir',
        name,
      });
      return await files.getDirectory(dirId);
    });
  };

export const createDirectory =
  (parent: ID, name?: string) => async (tester: Tester) => {
    const input = {
      parent,
      name: name ?? Case.capital(faker.lorem.words()),
    };

    const result = await tester.run(CreateDirectoryDoc, {
      input,
    });

    const actual = result.createDirectory;
    expect(actual).toBeTruthy();
    expect(actual.name).toBe(input.name);

    return actual;
  };

const CreateDirectoryDoc = graphql(
  `
    mutation createDirectory($input: CreateDirectory!) {
      createDirectory(input: $input) {
        ...fileNode
      }
    }
  `,
  [fileNode],
);
