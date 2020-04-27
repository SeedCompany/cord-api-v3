import { gql } from 'apollo-server-core';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import {
  createFile,
  createSession,
  createTestApp,
  createUser,
  expectNotFound,
  fragments,
  TestApp,
} from './utility';
import { createDirectory } from './utility/create-directory';

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

  it('create a file node', async () => {
    const id = generate();
    const testDir = await createDirectory(app);

    const file = await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });
    expect(file.id).toBeDefined();
    expect(file.name).toBe('testFile');
  });

  it('read one file by id', async () => {
    const id = generate();
    const testDir = await createDirectory(app);
    const file = await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });

    const { file: actual } = await app.graphql.query(
      gql`
        query file($id: ID!) {
          file(id: $id) {
            id
            name
          }
        }
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
  it('update file', async () => {
    // updating a file is adding a new version to file
    const id = generate();
    const testDir = await createDirectory(app);
    const file = await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });
    const fvId = generate();
    const result = await app.graphql.mutate(
      gql`
        mutation updateFile($input: UpdateFileInput!) {
          updateFile(input: $input) {
            id
            name
          }
        }
      `,
      {
        input: {
          uploadId: fvId,
          parentId: file.id,
        },
      }
    );
    const updated = result.updateFile;
    expect(updated.id).toBe(file.id);
    expect(updated.name).toBe('testFile');
  });

  // DELETE FILE
  it('delete file', async () => {
    const id = generate();
    const testDir = await createDirectory(app);
    const file = await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteFileNode($id: ID!) {
          deleteFileNode(id: $id)
        }
      `,
      {
        id: file.id,
      }
    );

    expect(result.deleteFileNode).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
        gql`
          query file($id: ID!) {
            file(id: $id) {
              id
            }
          }
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
