import { faker } from '@faker-js/faker';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import type { DurationIn } from '@seedcompany/common/temporal/luxon';
import { startCase, times } from 'lodash';
import { DateTime, Duration, Settings } from 'luxon';
import { type ID, Role } from '~/common';
import { DatabaseService } from '~/core/database';
import { graphql } from '~/graphql';
import { FileBucket, type LocalBucket } from '../src/components/file/bucket';
import {
  type Directory,
  FileNodeType,
  type FileUploadRequested,
} from '../src/components/file/dto';
import { createDirectory, createRootDirectory } from './operations/directory';
import {
  createFileVersion,
  type FakeFile,
  generateFakeFile,
  getFileNode,
  getFileNodeChildren,
  requestFileUpload,
  uploadFileContents,
} from './operations/file';
import {
  createApp,
  createTesterWithRole,
  getRootTester,
  type IdentifiedTester,
  type TestApp,
  type Tester,
} from './setup';
import { errors, type fragments } from './utility';

export const uploadFile =
  (
    parent: ID,
    input: Partial<FakeFile> = {},
    uploadRequest?: FileUploadRequested,
  ) =>
  async (tester: Tester) => {
    const { id, url } =
      uploadRequest ?? (await tester.apply(requestFileUpload()));

    const fakeFile = await tester.apply(uploadFileContents(url, input));

    const fileNode = await tester.apply(
      createFileVersion({
        upload: id,
        parent,
        name: fakeFile.name,
      }),
    );

    return fileNode;
  };

const deleteNode = (id: ID) => async (tester: Tester) => {
  await tester.run(
    graphql(`
      mutation deleteFileNode($id: ID!) {
        deleteFileNode(id: $id) {
          __typename
        }
      }
    `),
    { id },
  );
};

const expectNodeNotFound = (id: ID) => async (tester: Tester) => {
  await tester
    .run(
      graphql(`
        query fileNode($id: ID!) {
          fileNode(id: $id) {
            id
          }
        }
      `),
      { id },
    )
    .expectError(errors.notFound());
};

function shiftNow(duration: DurationIn) {
  Settings.now = () => Date.now() + Duration.from(duration).toMillis();
}

function resetNow() {
  Settings.now = () => Date.now();
}

const expectEqualContent =
  (url: string, expected: FakeFile) => async (tester: Tester) => {
    const expectedContents = expected.content;
    const actualContents = await tester.http.get(url).buffer();
    expect(expectedContents).toEqual(actualContents);
  };

describe('File e2e', () => {
  let app: TestApp;
  let bucket: LocalBucket;
  let root: Directory;
  let me: IdentifiedTester;

  beforeAll(async () => {
    app = await createApp();
    bucket = app.get(FileBucket);
    me = await createTesterWithRole(app, Role.ProjectManager);
  });

  beforeEach(async () => {
    await bucket.clear();
    root = await (await getRootTester(app)).apply(createRootDirectory());
  });

  afterEach(resetNow);

  it('upload file and download', async () => {
    const fakeFile = generateFakeFile();

    const created = await me.apply(uploadFile(root.id, fakeFile));
    const fetched = await me.apply(getFileNode(created.id));
    if (fetched.__typename !== 'File') throw new Error();
    for (const file of [created, fetched]) {
      expect(file.id).toBeDefined();
      expect(file.name).toEqual(fakeFile.name);
      expect(file.type).toEqual(FileNodeType.File);
      expect(file.size).toEqual(fakeFile.size);
      expect(file.mimeType).toEqual(fakeFile.mimeType);
      expect(file.createdBy.id).toEqual(me.identity.id);
      expect(file.modifiedBy.id).toEqual(me.identity.id);
      const modifiedAt = DateTime.fromISO(file.modifiedAt);
      expect(modifiedAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      const createdAt = DateTime.fromISO(file.createdAt);
      expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      await me.apply(expectEqualContent(file.url, fakeFile));
      expect(file.parents[0]!.id).toEqual(root.id);
    }
  });

  it('get file version', async () => {
    const fakeFile = generateFakeFile();
    const upload = await me.apply(requestFileUpload());
    const file = await me.apply(uploadFile(root.id, fakeFile, upload));

    // Maybe get version from file.children when implemented
    const version = await me.apply(getFileNode(upload.id));
    if (version.__typename !== 'FileVersion') throw new Error();

    expect(version.id).toBeDefined();
    expect(version.name).toEqual(fakeFile.name);
    expect(version.type).toEqual(FileNodeType.FileVersion);
    expect(version.size).toEqual(fakeFile.size);
    expect(version.mimeType).toEqual(fakeFile.mimeType);
    expect(version.createdBy.id).toEqual(me.identity.id);
    const createdAt = DateTime.fromISO(version.createdAt);
    expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
    await me.apply(expectEqualContent(file.url, fakeFile));
    expect(version.parents[0]!.id).toEqual(file.id);
  });

  it('update file using file id', async () => {
    const initial = await me.apply(uploadFile(root.id));
    shiftNow({ days: 2 });

    // Create a new tester with a different user
    const otherTester = await createTesterWithRole(
      app,
      me.identity.roles.value,
    );

    const fakeFile = generateFakeFile();
    const updated = await otherTester.apply(uploadFile(initial.id, fakeFile));
    await assertFileChanges(updated, initial, fakeFile);
    expect(updated.modifiedBy.id).toEqual(otherTester.identity.id);
    // TODO Files have their own names, should these be updated to match the new version's name?
    // expect(updatedFile.name).not.toEqual(initialFile.name);
  });

  it.skip('update file using directory with same file name', async () => {
    const initial = await me.apply(uploadFile(root.id));
    shiftNow({ days: 2 });

    const fakeFile = {
      ...generateFakeFile(),
      name: initial.name,
    };
    const updated = await me.apply(uploadFile(root.id, fakeFile));
    await assertFileChanges(updated, initial, fakeFile);
  });

  async function assertFileChanges(
    updated: fragments.file,
    initial: fragments.file,
    input: FakeFile,
  ) {
    expect(updated.id).toEqual(initial.id);
    await me.apply(expectEqualContent(updated.url, input));
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
    const created = await me.apply(createDirectory(root.id, name));
    const fetched = await me.apply(getFileNode(created.id));
    for (const dir of [created, fetched]) {
      expect(dir.id).toBeDefined();
      expect(dir.type).toEqual(FileNodeType.Directory);
      expect(dir.name).toEqual(name);
      expect(dir.createdBy.id).toEqual(me.identity.id);
      const createdAt = DateTime.fromISO(dir.createdAt);
      expect(createdAt.diffNow().as('seconds')).toBeGreaterThan(-30);
      expect(dir.parents[0]!.id).toEqual(root.id);
    }
  });

  it('list parents', async () => {
    const a = await me.apply(createDirectory(root.id));
    const b = await me.apply(createDirectory(a.id));
    const upload = await me.apply(requestFileUpload());
    const c = await me.apply(uploadFile(b.id, {}, upload));
    // Maybe get version from file.children when implemented
    const version = await me.apply(getFileNode(upload.id));
    const { parents } = version;

    expect(parents.map((n) => n.id)).toEqual([c.id, b.id, a.id, root.id]);
  });

  it.skip('delete file', async () => {
    const { id } = await me.apply(uploadFile(root.id));
    await me.apply(deleteNode(id));
    await me.apply(expectNodeNotFound(id));
  });

  it.skip('delete directory', async () => {
    const { id } = await me.apply(createDirectory(root.id));
    await me.apply(deleteNode(id));
    await me.apply(expectNodeNotFound(id));
  });

  it.skip('delete version', async () => {
    const upload = await me.apply(requestFileUpload());
    const file = await me.apply(uploadFile(root.id, {}, upload));
    // Maybe get version from file.children when implemented
    const version = await me.apply(getFileNode(upload.id));
    await me.apply(deleteNode(version.id));
    await me.apply(expectNodeNotFound(version.id));
    await me.apply(expectNodeNotFound(file.id));
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
      dir = await me.apply(createDirectory(root.id));
      // create a bunch of files
      expectedTotalFiles = 10;
      const files = await Promise.all(
        times(expectedTotalFiles).map(() =>
          me.apply(
            uploadFile(dir.id, {
              mimeType: 'font/woff',
            }),
          ),
        ),
      );

      expectedTotalVideos = 4;
      const videos = await Promise.all(
        times(expectedTotalVideos).map(() =>
          me.apply(
            uploadFile(dir.id, {
              mimeType: 'video/mp4',
            }),
          ),
        ),
      );
      expectedTotalFiles += expectedTotalVideos;

      expectedTotalDirs = 3;
      const dirs = await Promise.all(
        times(expectedTotalDirs).map(() => me.apply(createDirectory(dir.id))),
      );
      expectedTotalChildren = expectedTotalFiles + expectedTotalDirs;
      expectedChildren = [...files, ...videos, ...dirs];
    });

    it('full list', async () => {
      const children = await me.apply(getFileNodeChildren(dir.id));
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

      const firstPage = await me.apply(
        getFileNodeChildren(dir.id, {
          count,
          page: 1,
        }),
      );
      expect(firstPage.total).toEqual(expectedTotalChildren);
      expect(firstPage.hasMore).toBeTruthy();
      expect(firstPage.items.length).toEqual(count); // complete page

      const nextPage = await me.apply(
        getFileNodeChildren(dir.id, {
          count,
          page: 2,
        }),
      );
      expect(nextPage.total).toEqual(expectedTotalChildren);
      expect(nextPage.hasMore).toBeTruthy();
      expect(nextPage.items.length).toEqual(count); // complete page
      expect(nextPage.items.map((n) => n.id)).not.toEqual(
        expect.arrayContaining(firstPage.items.map((n) => n.id)),
      );

      const lastPage = await me.apply(
        getFileNodeChildren(dir.id, {
          count,
          page: 3,
        }),
      );
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
      const children = await me.apply(
        getFileNodeChildren(dir.id, {
          filter: {
            type: FileNodeType.File,
          },
        }),
      );
      expect(children.total).toEqual(expectedTotalFiles);
      expect(children.hasMore).toBeFalsy();
      expect(children.items.length).toEqual(expectedTotalFiles);
      expect(
        children.items.every((n) => n.type === FileNodeType.File),
      ).toBeTruthy();
    });

    it('filter directories', async () => {
      const children = await me.apply(
        getFileNodeChildren(dir.id, {
          filter: {
            type: FileNodeType.Directory,
          },
        }),
      );
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
      const uploadRequest = await me.apply(requestFileUpload());
      file = await me.apply(uploadFile(root.id, {}, uploadRequest));
      // create a bunch of versions
      const extraVersions = 2;
      for (const _ of times(extraVersions)) {
        const upload = await me.apply(requestFileUpload());
        await me.apply(uploadFile(file.id, {}, upload));
        expectedVersionIds.push(upload.id);
      }

      expectedVersionIds.push(uploadRequest.id); // initial version id
      expectedTotalVersions = extraVersions + 1; // +1 for initial version
    });

    it('full list', async () => {
      const children = await me.apply(getFileNodeChildren(file.id));
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
