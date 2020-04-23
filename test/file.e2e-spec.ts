import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValid } from 'shortid';
import {
  createFile,
  createSession,
  createTestApp,
  createUser,
  expectNotFound,
  fragments,
  TestApp,
} from './utility';

describe('File e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it.skip('create a file node', async () => {
    const file = await createFile(app);
    expect(file.id).toBeDefined();
  });

  it.skip('read one file by id', async () => {
    const file = await createFile(app);

    const { file: actual } = await app.graphql.query(
      gql`
        query file($id: ID!) {
          file(id: $id) {
            ...file
          }
        }
        ${fragments.file}
      `,
      {
        id: file.id,
      }
    );

    expect(actual.id).toBe(file.id);
    expect(isValid(actual.id)).toBeTruthy();
    //expect(actual.name.value).toEqual(file.name.value);
    expect(actual.name).toEqual(file.name);
  });

  // UPDATE FILE
  it.skip('update file', async () => {
    const file = await createFile(app);
    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateFile($input: UpdateFileInput!) {
          updateFile(input: $input) {
            file {
              ...file
            }
          }
        }
        ${fragments.file}
      `,
      {
        input: {
          file: {
            id: file.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateFile.file;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(file.id);
    expect(updated.name.value).toBe(newName);
  });

  // DELETE FILE
  it.skip('delete file', async () => {
    const file = await createFile(app);

    const result = await app.graphql.mutate(
      gql`
        mutation deleteFile($id: ID!) {
          deleteFile(id: $id)
        }
      `,
      {
        id: file.id,
      }
    );

    expect(result.deleteFile).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
        gql`
          query file($id: ID!) {
            file(id: $id) {
              ...file
            }
          }
          ${fragments.file}
        `,
        {
          id: file.id,
        }
      )
    );
  });

  // LIST Files
  it.skip('List view of files', async () => {
    // create a bunch of files
    const numFiles = 10;
    await Promise.all(
      times(numFiles).map(() => createFile(app, { name: 'Italian' }))
    );
    // test reading new file
    const { files } = await app.graphql.query(gql`
      query {
        files {
          items {
            ...file
          }
          hasMore
          total
        }
      }
      ${fragments.file}
    `);

    expect(files.items.length).toBeGreaterThan(numFiles);
  });
});
