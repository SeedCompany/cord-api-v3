import { gql } from 'apollo-server-core';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { DatabaseService } from '../src/core';
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

describe.skip('File e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const db = app.get(DatabaseService);
    // remove bad data to ensure consistency check
    await db
      .query()
      .raw(
        `
        MATCH (f: File), (d: Directory), (fv: FileVersion) 
          detach delete f, fv, d
        `
      )
      .run();
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

  it('should check consistency in FILE basenodes', async () => {
    const db = app.get(DatabaseService);
    const id = generate();
    const testDir = await createDirectory(app);

    const file = await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });
    const testResult = await app.graphql.query(
      gql`
        query checkFileConsistency($input: BaseNodeConsistencyInput!) {
          checkFileConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'File' },
      }
    );
    expect(testResult.checkFileConsistency).toBeTruthy();

    // check for inconsistency
    await db
      .query()
      .raw(
        `
        MATCH
          (file: File {active: true, id: "${file.id}"}),
          (file)-[rel:name {active: true}]->(nm: Property {active: true})
        SET rel.active = false
        RETURN
          file, rel
        `
      )
      .run();
    const result = await app.graphql.query(
      gql`
        query checkFileConsistency($input: BaseNodeConsistencyInput!) {
          checkFileConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'File' },
      }
    );
    expect(result.checkFileConsistency).toBeFalsy();
  });

  it('should check for consistency in Directory basenodes', async () => {
    const db = app.get(DatabaseService);
    const id = generate();
    const testDir = await createDirectory(app);

    await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });
    const testResult = await app.graphql.query(
      gql`
        query checkFileConsistency($input: BaseNodeConsistencyInput!) {
          checkFileConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'Directory' },
      }
    );
    expect(testResult.checkFileConsistency).toBeTruthy();
    // check for inconsistency
    await db
      .query()
      .raw(
        `
          MATCH
            (dir: Directory {active: true, id: "${testDir.id}"}),
            (dir)-[rel:name {active: true}]->(nm: Property {active: true})
          SET rel.active = false
          RETURN
          dir, rel
          `
      )
      .run();
    const result = await app.graphql.query(
      gql`
        query checkFileConsistency($input: BaseNodeConsistencyInput!) {
          checkFileConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'Directory' },
      }
    );
    expect(result.checkFileConsistency).toBeFalsy();
  });

  it('should check consistency in FileVersion basenodes', async () => {
    const db = app.get(DatabaseService);
    const id = generate();
    const testDir = await createDirectory(app);

    const file = await createFile(app, {
      uploadId: id,
      parentId: testDir.id,
      name: 'testFile',
    });
    const testResult = await app.graphql.query(
      gql`
        query checkFileConsistency($input: BaseNodeConsistencyInput!) {
          checkFileConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'FileVersion' },
      }
    );
    expect(testResult.checkFileConsistency).toBeTruthy();

    await db
      .query()
      .raw(
        `
        MATCH
          (file: File {active: true, id: "${file.id}"}),
          (file)-[rel: version {active: true}]->(fv: FileVersion {active: true}),
          (fv)-[relation: mimeType {active: true}]->(mt: Property {active: true})
        SET
          mt.active = false
        RETURN
          fv, mt, relation
        `
      )
      .run();
    const result = await app.graphql.query(
      gql`
        query checkFileConsistency($input: BaseNodeConsistencyInput!) {
          checkFileConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'FileVersion' },
      }
    );
    expect(result.checkFileConsistency).toBeFalsy();
  });
});
