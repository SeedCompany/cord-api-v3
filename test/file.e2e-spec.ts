import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { startCase, times } from 'lodash';
import { DateTime, Duration, DurationObject, Settings } from 'luxon';
import { AuthenticationService } from '../src/components/authentication';
import {
  Directory,
  FileNodeCategory,
  FileNodeType,
  RequestUploadOutput,
} from '../src/components/file';
import { LocalBucket } from '../src/components/file/bucket';
import { FileRepository } from '../src/components/file/file.repository';
import { FilesBucketToken } from '../src/components/file/files-bucket.factory';
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
  generateFakeFile,
  getFileNode,
  getFileNodeChildren,
  login,
  requestFileUpload,
  TestApp,
  uploadFileContents,
} from './utility';
import {
  createDirectory,
  createRootDirectory,
} from './utility/create-directory';
import {
  RawDirectory,
  RawFile,
  RawFileNode,
  RawFileVersion,
} from './utility/fragments';

export async function uploadFile(
  app: TestApp,
  parentId: string,
  input: Partial<FakeFile> = {},
  uploadRequest?: RequestUploadOutput
) {
  const { id, url } = uploadRequest ?? (await requestFileUpload(app));

  const fakeFile = await uploadFileContents(app, url, input);

  const fileNode = await createFileVersion(app, {
    uploadId: id,
    parentId,
    name: fakeFile.name,
  });

  return fileNode;
}

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
  let app: TestApp;
  let bucket: LocalBucket;
  let root: Directory;
  let me: User;
  const myPassword = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    bucket = app.get(FilesBucketToken);
    await createSession(app);
    me = await createUser(app, { password: myPassword });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await bucket.clear();
    root = await createRootDirectory(app);
    // reset logged in user
    await login(app, {
      email: me.email.value,
      password: myPassword,
    });
  });

  afterEach(resetNow);

  it('upload file and download', async () => {
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
      expect((await bucket.download(file.downloadUrl)).Body).toEqual(
        fakeFile.content
      );
      expect(file.parents[0].id).toEqual(root.id);
    }
  });

  it('get file version', async () => {
    const fakeFile = generateFakeFile();
    const upload = await requestFileUpload(app);
    const file = await uploadFile(app, root.id, fakeFile, upload);

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
    expect((await bucket.download(version.downloadUrl)).Body).toEqual(
      fakeFile.content
    );
    expect(version.parents[0].id).toEqual(file.id);
  });

  it('update file using file id', async () => {
    const initial = await uploadFile(app, root.id);
    shiftNow({ days: 2 });

    // change user
    const current = await login(app, {
      email: me.email.value,
      password: myPassword,
    });

    const fakeFile = generateFakeFile();
    const updated = await uploadFile(app, initial.id, fakeFile);
    await assertFileChanges(updated, initial, fakeFile);

    expect(updated.modifiedBy.id).toEqual(current.login.user.id);
    // TODO Files have their own names, should these be updated to match the new version's name?
    // expect(updatedFile.name).not.toEqual(initialFile.name);
  });

  it.skip('update file using directory with same file name', async () => {
    const initial = await uploadFile(app, root.id);
    shiftNow({ days: 2 });

    const fakeFile = {
      ...generateFakeFile(),
      name: initial.name,
    };
    const updated = await uploadFile(app, root.id, fakeFile);
    await assertFileChanges(updated, initial, fakeFile);
  });

  async function assertFileChanges(
    updated: RawFile,
    initial: RawFile,
    input: FakeFile
  ) {
    expect(updated.id).toEqual(initial.id);
    expect((await bucket.download(updated.downloadUrl)).Body).toEqual(
      input.content
    );
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
      expect(dir.parents[0].id).toEqual(root.id);
    }
  });

  it('list parents', async () => {
    const a = await createDirectory(app, root.id);
    const b = await createDirectory(app, a.id);
    const upload = await requestFileUpload(app);
    const c = await uploadFile(app, b.id, {}, upload);
    // Maybe get version from file.children when implemented
    const version = await getFileNode(app, upload.id);
    const { parents } = version;

    expect(parents.map((n) => n.id)).toEqual([c.id, b.id, a.id, root.id]);
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

  describe('directory children', () => {
    let dir: RawDirectory;
    let expectedChildren: RawFileNode[];
    let expectedTotalChildren: number;
    let expectedTotalDirs: number;
    let expectedTotalFiles: number;
    let expectedTotalVideos: number;
    beforeEach(async () => {
      // Isolated directory to test in
      dir = await createDirectory(app, root.id);
      // create a bunch of files
      expectedTotalFiles = 10;
      const files = await Promise.all(
        times(expectedTotalFiles).map(() =>
          uploadFile(app, dir.id, {
            mimeType: 'font/woff',
          })
        )
      );

      expectedTotalVideos = 4;
      const videos = await Promise.all(
        times(expectedTotalVideos).map(() =>
          uploadFile(app, dir.id, {
            mimeType: 'video/mp4',
          })
        )
      );
      expectedTotalFiles += expectedTotalVideos;

      expectedTotalDirs = 3;
      const dirs = await Promise.all(
        times(expectedTotalDirs).map(() => createDirectory(app, dir.id))
      );
      expectedTotalChildren = expectedTotalFiles + expectedTotalDirs;
      expectedChildren = [...files, ...videos, ...dirs];
    });

    it('full list', async () => {
      const children = await getFileNodeChildren(app, dir.id);
      expect(children.total).toEqual(expectedTotalChildren);
      expect(children.hasMore).toBeFalsy();
      expect(children.items.length).toEqual(expectedTotalChildren);
      expect(children.items.map((n) => n.id)).toEqual(
        expect.arrayContaining(expectedChildren.map((n) => n.id))
      );
      const expectedFile = expectedChildren.find(
        (n) => n.type === FileNodeType.File
      )!;
      const actualFile = children.items.find((n) => n.id === expectedFile.id)!;
      expect(actualFile.category).toEqual(expectedFile.category);
    });

    it('paginated', async () => {
      // Divide evenly between 3 pages
      const count = Math.ceil(expectedTotalChildren / 3);

      const firstPage = await getFileNodeChildren(app, dir.id, {
        count,
        page: 1,
      });
      expect(firstPage.total).toEqual(expectedTotalChildren);
      expect(firstPage.hasMore).toBeTruthy();
      expect(firstPage.items.length).toEqual(count); // complete page

      const nextPage = await getFileNodeChildren(app, dir.id, {
        count,
        page: 2,
      });
      expect(nextPage.total).toEqual(expectedTotalChildren);
      expect(nextPage.hasMore).toBeTruthy();
      expect(nextPage.items.length).toEqual(count); // complete page
      expect(nextPage.items.map((n) => n.id)).not.toEqual(
        expect.arrayContaining(firstPage.items.map((n) => n.id))
      );

      const lastPage = await getFileNodeChildren(app, dir.id, {
        count,
        page: 3,
      });
      expect(lastPage.total).toEqual(expectedTotalChildren);
      expect(lastPage.hasMore).toBeFalsy();
      expect(lastPage.items.length).toEqual(expectedTotalChildren - count * 2); // partial page
      expect(lastPage.items.map((n) => n.id)).not.toEqual(
        expect.arrayContaining(
          firstPage.items.concat(nextPage.items).map((n) => n.id)
        )
      );
    });

    it('filter files', async () => {
      const children = await getFileNodeChildren(app, dir.id, {
        filter: {
          type: FileNodeType.File,
        },
      });
      expect(children.total).toEqual(expectedTotalFiles);
      expect(children.hasMore).toBeFalsy();
      expect(children.items.length).toEqual(expectedTotalFiles);
      expect(
        children.items.every((n) => n.type === FileNodeType.File)
      ).toBeTruthy();
    });

    it('filter directories', async () => {
      const children = await getFileNodeChildren(app, dir.id, {
        filter: {
          type: FileNodeType.Directory,
        },
      });
      expect(children.total).toEqual(expectedTotalDirs);
      expect(children.hasMore).toBeFalsy();
      expect(children.items.length).toEqual(expectedTotalDirs);
      expect(
        children.items.every((n) => n.type === FileNodeType.Directory)
      ).toBeTruthy();
    });

    it.skip('filter category', async () => {
      const category = 'Video' as FileNodeCategory;
      const children = await getFileNodeChildren(app, dir.id, {
        filter: {
          category: [category],
        },
      });
      expect(children.total).toEqual(expectedTotalVideos);
      expect(children.hasMore).toBeFalsy();
      expect(children.items.length).toEqual(expectedTotalVideos);
      expect(
        children.items.map((n) => n.category).every((n) => n === category)
      ).toBeTruthy();
    });
  });

  describe('file children', () => {
    let file: RawFile;
    const expectedVersionIds: string[] = [];
    let expectedTotalVersions: number;

    afterAll(async () => {
      // revert the changes so consistency check will be passed for remaining file nodes.
      await app
        .get(DatabaseService)
        .query()
        .raw(
          `
          MATCH
            (file: File {active: true}),
            (file)-[rel:name {active: false}]->(nm: Property {active: true})
          SET rel.active = true
          RETURN
            file, rel
          `
        )
        .run();

      await app
        .get(DatabaseService)
        .query()
        .raw(
          `
          MATCH
            (dir: Directory {active: true}),
            (dir)-[rel:name {active: false}]->(nm: Property {active: true})
          SET rel.active = true
          RETURN
          dir, rel
          `
        )
        .run();

      await app
        .get(DatabaseService)
        .query()
        .raw(
          `
        MATCH
          (file: FileNode {active: true}),
          (file)<-[:parent {active: true}]-(fv: FileVersion {active: true}),
          (fv)-[:mimeType {active: true}]->(mt: Property {active: false})
        SET
          mt.active = true
        RETURN
          fv, mt
        `
        )
        .run();
    });

    beforeEach(async () => {
      const uploadRequest = await requestFileUpload(app);
      file = await uploadFile(app, root.id, {}, uploadRequest);
      // create a bunch of versions
      const extraVersions = 2;
      for (const _ of times(extraVersions)) {
        const upload = await requestFileUpload(app);
        await uploadFile(app, file.id, {}, upload);
        expectedVersionIds.push(upload.id);
      }

      expectedVersionIds.push(uploadRequest.id); // initial version id
      expectedTotalVersions = extraVersions + 1; // +1 for initial version
    });

    it('full list', async () => {
      const children = await getFileNodeChildren(app, file.id);
      expect(children.total).toEqual(expectedTotalVersions);
      expect(children.hasMore).toBeFalsy();
      expect(children.items.length).toEqual(expectedTotalVersions);
      expect(children.items.map((n) => n.id)).toEqual(
        expect.arrayContaining(expectedVersionIds)
      );
      expect(
        children.items.every((n) => n.type === FileNodeType.FileVersion)
      ).toBeTruthy();
    });
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
