import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { startCase, times } from 'lodash';
import { DateTime, Duration, DurationObject, Settings } from 'luxon';
import { AuthenticationService } from '../src/components/authentication';
import {
  Directory,
  FileNodeCategory,
  FileNodeType,
} from '../src/components/file';
import { FileRepository } from '../src/components/file/file.repository';
import { MemoryBucket } from '../src/components/file/memory-bucket';
import { getCategoryFromMimeType } from '../src/components/file/mimeTypes';
import { User } from '../src/components/user';
import { DatabaseService } from '../src/core';
import {
  createFileVersion,
  createSession,
  createTestApp,
  createUser,
  expectNotFound,
  FakeFile,
  fragments,
  generateFakeFile,
  getFileNode,
  login,
  requestFileUpload,
  TestApp,
  uploadFile,
} from './utility';
import {
  createDirectory,
  createRootDirectory,
} from './utility/create-directory';
import { RawFile, RawFileVersion } from './utility/fragments';

async function deleteNode(app: TestApp, id: string) {
  await app.graphql.mutate(
    gql`
      mutation deleteFileNode($id: ID!) {
        deleteFileNode(id: $id)
      }
    `,
    {
      id,
    }
  );
}

async function expectNodeNotFound(app: TestApp, id: string) {
  await expectNotFound(
    app.graphql.query(
      gql`
        query fileNode($id: ID!) {
          fileNode(id: $id) {
            id
          }
        }
      `,
      {
        id,
      }
    )
  );
}

function shiftNow(duration: DurationObject) {
  Settings.now = () =>
    Date.now() + Duration.fromObject(duration).as('milliseconds');
}

function resetNow() {
  Settings.now = () => Date.now();
}

describe('File e2e', () => {
  jest.setTimeout(50000);
  let app: TestApp;
  let bucket: MemoryBucket;
  let root: Directory;
  let me: User;
  const myPassword = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    bucket = app.get(MemoryBucket);
    await createSession(app);
    me = await createUser(app, { password: myPassword });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const db = app.get(DatabaseService);
    // remove old data to ensure consistency check
    await db.query().matchNode('n', 'FileNode').detachDelete('n').run();
    bucket.clear();
    root = await createRootDirectory(app);
    // reset logged in user
    await login(app, {
      email: me.email.value,
      password: myPassword,
    });
  });

  afterEach(resetNow);

  it.skip('upload file and download', async () => {
    const fakeFile = generateFakeFile();

    const created = await uploadFile(app, root.id, fakeFile);
    const fetched = (await getFileNode(app, created.id)) as RawFile;
    for (const file of [created, fetched]) {
      expect(file.id).toBeDefined();
      expect(file.name).toEqual(fakeFile.name);
      expect(file.type).toEqual(FileNodeType.File);
      expect(file.size).toEqual(fakeFile.size);
      expect(file.mimeType).toEqual(fakeFile.mimeType);
      expect((FileNodeCategory as any)[file.category]).toEqual(
        getCategoryFromMimeType(fakeFile.mimeType)
      );
      expect(file.createdBy.id).toEqual(me.id);
      expect(file.modifiedBy.id).toEqual(me.id);
      const modifiedAt = DateTime.fromISO(file.modifiedAt);
      expect(modifiedAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      const createdAt = DateTime.fromISO(file.createdAt);
      expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      expect(bucket.download(file.downloadUrl)).toEqual(fakeFile.content);
    }
  });

  it('get file version', async () => {
    const fakeFile = generateFakeFile();
    const upload = await requestFileUpload(app);
    await uploadFile(app, root.id, fakeFile, upload);

    // Maybe get version from file.children when implemented
    const version = (await getFileNode(app, upload.id)) as RawFileVersion;

    expect(version.id).toBeDefined();
    expect(version.name).toEqual(fakeFile.name);
    expect(version.type).toEqual(FileNodeType.FileVersion);
    expect(version.size).toEqual(fakeFile.size);
    expect(version.mimeType).toEqual(fakeFile.mimeType);
    expect((FileNodeCategory as any)[version.category]).toEqual(
      getCategoryFromMimeType(fakeFile.mimeType)
    );
    expect(version.createdBy.id).toEqual(me.id);
    const createdAt = DateTime.fromISO(version.createdAt);
    expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
    expect(bucket.download(version.downloadUrl)).toEqual(fakeFile.content);
  });

  it('update file using file id', async () => {
    const initial = await uploadFile(app, root.id);
    shiftNow({ days: 2 });

    // change user
    const current = await createUser(app);

    const fakeFile = generateFakeFile();
    const updated = await uploadFile(app, initial.id, fakeFile);
    assertFileChanges(updated, initial, fakeFile);
    expect(updated.modifiedBy.id).toEqual(current.id);
    // TODO Files have their own names, should these be updated to match the new version's name?
    // expect(updatedFile.name).not.toEqual(initialFile.name);
  });

  it('update file using directory with same file name', async () => {
    const initial = await uploadFile(app, root.id);
    shiftNow({ days: 2 });

    const fakeFile = {
      ...generateFakeFile(),
      name: initial.name,
    };
    const updated = await uploadFile(app, root.id, fakeFile);
    assertFileChanges(updated, initial, fakeFile);
  });

  function assertFileChanges(
    updated: RawFile,
    initial: RawFile,
    input: FakeFile
  ) {
    expect(updated.id).toEqual(initial.id);
    expect(bucket.download(updated.downloadUrl)).toEqual(input.content);
    expect(updated.size).toEqual(input.size);
    expect(updated.mimeType).toEqual(input.mimeType);
    const createdAt = DateTime.fromISO(updated.createdAt);
    expect(createdAt.toMillis()).toEqual(
      DateTime.fromISO(initial.createdAt).toMillis()
    );
    const modifiedAt = DateTime.fromISO(updated.modifiedAt);
    expect(modifiedAt.diff(createdAt).as('days')).toBeGreaterThanOrEqual(2);
  }

  it('create directory', async () => {
    const name = startCase(faker.lorem.words());
    const created = await createDirectory(app, root.id, name);
    const fetched = await getFileNode(app, created.id);
    for (const dir of [created, fetched]) {
      expect(dir.id).toBeDefined();
      expect(dir.type).toEqual(FileNodeType.Directory);
      expect(dir.name).toEqual(name);
      expect(dir.createdBy.id).toEqual(me.id);
      const createdAt = DateTime.fromISO(dir.createdAt);
      expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
    }
  });

  it('delete file', async () => {
    const { id } = await uploadFile(app, root.id);
    await deleteNode(app, id);
    await expectNodeNotFound(app, id);
  });

  it('delete directory', async () => {
    const { id } = await createDirectory(app, root.id);
    await deleteNode(app, id);
    await expectNodeNotFound(app, id);
  });

  it('delete version', async () => {
    const upload = await requestFileUpload(app);
    const file = await uploadFile(app, root.id, {}, upload);
    // Maybe get version from file.children when implemented
    const version = (await getFileNode(app, upload.id)) as RawFileVersion;
    await deleteNode(app, version.id);
    await expectNodeNotFound(app, version.id);
    await expectNodeNotFound(app, file.id);
  });

  it.skip('List view of files', async () => {
    // create a bunch of files
    const numFiles = 10;
    await Promise.all(
      times(numFiles).map(() =>
        createFileVersion(app, {
          parentId: root.id,
          uploadId: '',
        })
      )
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
      ${fragments.fileNode}
    `);

    expect(files.items.length).toBeGreaterThan(numFiles);
  });

  describe('check consistency', () => {
    const expectConsistency = async (type: FileNodeType, expected = true) => {
      const session = await app
        .get(AuthenticationService)
        .createSession(app.graphql.authToken);

      const expecting = expect(
        app.get(FileRepository).checkConsistency(type, session)
      );
      if (expected) {
        await expecting.resolves.toBeUndefined();
      } else {
        await expecting.rejects.toThrowError();
      }
    };

    it('File', async () => {
      const file = await uploadFile(app, root.id);
      await expectConsistency(FileNodeType.File);

      // Validate that we correctly check for name
      // TODO createdBy, parent, ...?
      await app
        .get(DatabaseService)
        .query()
        .raw(
          `
        MATCH
          (file: File {active: true, id: $id}),
          (file)-[rel:name {active: true}]->(nm: Property {active: true})
        SET rel.active = false
        RETURN
          file, rel
        `,
          {
            id: file.id,
          }
        )
        .run();
      await expectConsistency(FileNodeType.File, false);
    });

    it('Directory', async () => {
      await uploadFile(app, root.id);
      await expectConsistency(FileNodeType.Directory);

      // Validate that we correctly check for name
      // TODO createdBy, parent, ...?
      await app
        .get(DatabaseService)
        .query()
        .raw(
          `
          MATCH
            (dir: Directory {active: true, id: $id}),
            (dir)-[rel:name {active: true}]->(nm: Property {active: true})
          SET rel.active = false
          RETURN
          dir, rel
          `,
          {
            id: root.id,
          }
        )
        .run();
      await expectConsistency(FileNodeType.Directory, false);
    });

    it('FileVersion', async () => {
      const file = await uploadFile(app, root.id);
      await expectConsistency(FileNodeType.FileVersion);

      // Validate that we correctly check for mimeType
      // TODO size, category, createdBy, parent, ...?
      await app
        .get(DatabaseService)
        .query()
        .raw(
          `
        MATCH
          (file: FileNode {active: true, id: $id}),
          (file)<-[:parent {active: true}]-(fv: FileVersion {active: true}),
          (fv)-[:mimeType {active: true}]->(mt: Property {active: true})
        SET
          mt.active = false
        RETURN
          fv, mt
        `,
          {
            id: file.id,
          }
        )
        .run();
      await expectConsistency(FileNodeType.FileVersion, false);
    });
  });
});
