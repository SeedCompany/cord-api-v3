import { faker } from '@faker-js/faker';
import got from 'got';
import { startCase, times } from 'lodash';
import {
  DateTime,
  Duration,
  type DurationObjectUnits as DurationObject,
  Settings,
} from 'luxon';
import { type ID, Role } from '~/common';
import { DatabaseService } from '~/core/database';
import { graphql } from '~/graphql';
import { FileBucket, type LocalBucket } from '../src/components/file/bucket';
import {
  type Directory,
  FileNodeType,
  type RequestUploadOutput,
} from '../src/components/file/dto';
import {
  createFileVersion,
  createSession,
  createTestApp,
  errors,
  type FakeFile,
  type fragments,
  generateFakeFile,
  getFileNode,
  getFileNodeChildren,
  registerUser,
  requestFileUpload,
  runInIsolatedSession,
  type TestApp,
  type TestUser,
  uploadFileContents,
} from './utility';
import {
  createDirectory,
  createRootDirectory,
} from './utility/create-directory';

export async function uploadFile(
  app: TestApp,
  parentId: ID,
  input: Partial<FakeFile> = {},
  uploadRequest?: RequestUploadOutput,
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

async function deleteNode(app: TestApp, id: ID) {
  await app.graphql.mutate(
    graphql(`
      mutation deleteFileNode($id: ID!) {
        deleteFileNode(id: $id) {
          __typename
        }
      }
    `),
    {
      id,
    },
  );
}

async function expectNodeNotFound(app: TestApp, id: ID) {
  await app.graphql
    .query(
      graphql(`
        query fileNode($id: ID!) {
          fileNode(id: $id) {
            id
          }
        }
      `),
      {
        id,
      },
    )
    .expectError(errors.notFound());
}

function shiftNow(duration: DurationObject) {
  Settings.now = () =>
    Date.now() + Duration.fromObject(duration).as('milliseconds');
}

function resetNow() {
  Settings.now = () => Date.now();
}

const expectEqualContent = async (
  app: TestApp,
  url: string,
  expected: FakeFile,
) => {
  const expectedContents = expected.content;
  const actualContents = await got(url, {
    headers: {
      Authorization: `Bearer ${app.graphql.authToken}`,
    },
    enableUnixSockets: true,
  }).buffer();
  expect(expectedContents).toEqual(actualContents);
};

describe('File e2e', () => {
  let app: TestApp;
  let bucket: LocalBucket;
  let root: Directory;
  let me: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    bucket = app.get(FileBucket);
    await createSession(app);
    me = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await bucket.clear();
    root = await createRootDirectory(app);
  });

  afterEach(resetNow);

  it('upload file and download', async () => {
    const fakeFile = generateFakeFile();

    const created = await uploadFile(app, root.id, fakeFile);
    const fetched = await getFileNode(app, created.id);
    if (fetched.__typename !== 'File') throw new Error();
    for (const file of [created, fetched]) {
      expect(file.id).toBeDefined();
      expect(file.name).toEqual(fakeFile.name);
      expect(file.type).toEqual(FileNodeType.File);
      expect(file.size).toEqual(fakeFile.size);
      expect(file.mimeType).toEqual(fakeFile.mimeType);
      expect(file.createdBy.id).toEqual(me.id);
      expect(file.modifiedBy.id).toEqual(me.id);
      const modifiedAt = DateTime.fromISO(file.modifiedAt);
      expect(modifiedAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      const createdAt = DateTime.fromISO(file.createdAt);
      expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      await expectEqualContent(app, file.url, fakeFile);
      expect(file.parents[0]!.id).toEqual(root.id);
    }
  });

  it('get file version', async () => {
    const fakeFile = generateFakeFile();
    const upload = await requestFileUpload(app);
    const file = await uploadFile(app, root.id, fakeFile, upload);

    // Maybe get version from file.children when implemented
    const version = await getFileNode(app, upload.id);
    if (version.__typename !== 'FileVersion') throw new Error();

    expect(version.id).toBeDefined();
    expect(version.name).toEqual(fakeFile.name);
    expect(version.type).toEqual(FileNodeType.FileVersion);
    expect(version.size).toEqual(fakeFile.size);
    expect(version.mimeType).toEqual(fakeFile.mimeType);
    expect(version.createdBy.id).toEqual(me.id);
    const createdAt = DateTime.fromISO(version.createdAt);
    expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
    await expectEqualContent(app, file.url, fakeFile);
    expect(version.parents[0]!.id).toEqual(file.id);
  });

  it('update file using file id', async () => {
    const initial = await uploadFile(app, root.id);
    shiftNow({ days: 2 });

    await runInIsolatedSession(app, async () => {
      // change user
      const current = await registerUser(app);

      const fakeFile = generateFakeFile();
      const updated = await uploadFile(app, initial.id, fakeFile);
      await assertFileChanges(updated, initial, fakeFile);
      expect(updated.modifiedBy.id).toEqual(current.id);
      // TODO Files have their own names, should these be updated to match the new version's name?
      // expect(updatedFile.name).not.toEqual(initialFile.name);
    });
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
    updated: fragments.file,
    initial: fragments.file,
    input: FakeFile,
  ) {
    expect(updated.id).toEqual(initial.id);
    await expectEqualContent(app, updated.url, input);
    expect(updated.size).toEqual(input.size);
    expect(updated.mimeType).toEqual(input.mimeType);
    const createdAt = DateTime.fromISO(updated.createdAt);
    expect(createdAt.toMillis()).toEqual(
      DateTime.fromISO(initial.createdAt).toMillis(),
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
      expect(dir.parents[0]!.id).toEqual(root.id);
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

  it.skip('delete file', async () => {
    const { id } = await uploadFile(app, root.id);
    await deleteNode(app, id);
    await expectNodeNotFound(app, id);
  });

  it.skip('delete directory', async () => {
    const { id } = await createDirectory(app, root.id);
    await deleteNode(app, id);
    await expectNodeNotFound(app, id);
  });

  it.skip('delete version', async () => {
    const upload = await requestFileUpload(app);
    const file = await uploadFile(app, root.id, {}, upload);
    // Maybe get version from file.children when implemented
    const version = await getFileNode(app, upload.id);
    await deleteNode(app, version.id);
    await expectNodeNotFound(app, version.id);
    await expectNodeNotFound(app, file.id);
  });

  describe('directory children', () => {
    let dir: fragments.directory;
    let expectedChildren: fragments.fileNode[];
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
          }),
        ),
      );

      expectedTotalVideos = 4;
      const videos = await Promise.all(
        times(expectedTotalVideos).map(() =>
          uploadFile(app, dir.id, {
            mimeType: 'video/mp4',
          }),
        ),
      );
      expectedTotalFiles += expectedTotalVideos;

      expectedTotalDirs = 3;
      const dirs = await Promise.all(
        times(expectedTotalDirs).map(() => createDirectory(app, dir.id)),
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
        expect.arrayContaining(expectedChildren.map((n) => n.id)),
      );
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
        expect.arrayContaining(firstPage.items.map((n) => n.id)),
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
          firstPage.items.concat(nextPage.items).map((n) => n.id),
        ),
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
        children.items.every((n) => n.type === FileNodeType.File),
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
        children.items.every((n) => n.type === FileNodeType.Directory),
      ).toBeTruthy();
    });
  });

  describe('file children', () => {
    let file: fragments.file;
    const expectedVersionIds: ID[] = [];
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
          `,
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
          `,
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
        `,
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
        expect.arrayContaining(expectedVersionIds),
      );
      expect(
        children.items.every((n) => n.type === FileNodeType.FileVersion),
      ).toBeTruthy();
    });
  });
});
