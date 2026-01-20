import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, isIdLike } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import {
  generateFakeFile,
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
import { createLanguage, createProject, fragments } from './utility';

describe('ProgressReport Media e2e', () => {
  let app: TestApp;
  let root: Tester;
  let fpm: IdentifiedTester;
  let project: fragments.project;
  let language: fragments.language;
  let reportId: ID<'ProgressReport'>;
  let image: ReturnType<typeof generateFakeFile>;

  beforeAll(async () => {
    app = await createApp();
    root = await getRootTester(app);
    fpm = await createTesterWithRole(app, 'ProjectManager');

    project = await createProject(fpm.legacyApp, {
      mouStart: CalendarDate.local(2023, 1, 1).toISO(),
      mouEnd: CalendarDate.local(2024, 1, 1).toISO(),
    });

    image = {
      ...generateFakeFile(),
      mimeType: 'image/png',
    };
  });

  beforeEach(async () => {
    language = await createLanguage(root.legacyApp);

    const { createEng } = await fpm.run(
      graphql(
        `
          mutation CreateLanguageEngagement($input: CreateLanguageEngagement!) {
            createEng: createLanguageEngagement(input: $input) {
              engagement {
                ...languageEngagement
                progressReports(input: { count: 1 }) {
                  items {
                    id
                  }
                }
              }
            }
          }
        `,
        [fragments.languageEngagement],
      ),
      {
        input: {
          project: project.id,
          language: language.id,
        },
      },
    );
    reportId = createEng.engagement.progressReports.items[0]!.id;
  });

  it('View uploadable options', async () => {
    const { report } = await fpm.run(
      graphql(`
        query UploadableVariantsOfReportMedia($id: ID!) {
          report: periodicReport(id: $id) {
            __typename
            ... on ProgressReport {
              media {
                uploadableVariants {
                  key
                }
              }
            }
          }
        }
      `),
      { id: reportId },
    );
    if (report.__typename !== 'ProgressReport') throw new Error();
    const { uploadableVariants } = report.media;
    const keys = uploadableVariants.map((v) => v.key);
    expect(keys).toEqual(['draft', 'translated', 'fpm']);
  });

  it('Upload', async () => {
    const { id: uploadId, url } = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(url, image));

    const input = {
      report: reportId,
      variant: 'draft' as any,
      category: 'CommunityEngagement',
      file: {
        upload: uploadId,
        name: 'A picture',
        media: {
          altText: 'A fake pic',
          caption: 'Look it works!',
        },
      },
    } satisfies UploadMedia;
    const upload = await fpm.apply(uploadMedia(input));

    expect(upload.id).toBe(reportId);
    expect(upload.media.items).toHaveLength(1);
    expect(upload.media.hasMore).toBeFalsy();
    expect(upload.media.total).toBe(1);

    const reportMedia = upload.media.items[0]!;
    expect(reportMedia.category).toBe(input.category);
    expect(reportMedia.variant.key).toBe(input.variant);
    expect(isIdLike(reportMedia.variantGroup)).toBeTruthy();
    expect(reportMedia.canEdit).toBeTruthy();
    expect(reportMedia.canDelete).toBeTruthy();
    expect(reportMedia.media.__typename).toBe('Image');
    expect(reportMedia.media.altText).toBe(input.file.media.altText);
    expect(reportMedia.media.caption).toBe(input.file.media.caption);
    expect(reportMedia.media.mimeType).toBe(image.mimeType);
  });

  it('Update', async () => {
    const upload = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(upload.url, image));
    const report = await fpm.apply(
      uploadMedia({
        report: reportId,
        variant: 'draft' as ID,
        category: 'CommunityEngagement',
        file: {
          upload: upload.id,
          name: 'A picture',
          media: {
            altText: 'A fake pic',
            caption: 'Look it works!',
          },
        },
      }),
    );

    const input = {
      id: report.media.items[0]!.id as ID<'ProgressReportMedia'>,
      category: 'WorkInProgress',
      altText: 'Actually a cat',
      caption: 'This it updates!',
    } as const;
    const { update } = await fpm.run(
      graphql(
        `
          mutation Update($input: UpdateProgressReportMedia!) {
            update: updateProgressReportMedia(input: $input) {
              ...reportMedia
            }
          }
        `,
        [reportMediaFrag],
      ),
      { input },
    );

    expect(update.category).toBe(input.category);
    expect(update.media.altText).toBe(input.altText);
    expect(update.media.caption).toBe(input.caption);
    expect(update.media.mimeType).toBe(image.mimeType);
  });

  it('Upload another variant in group', async () => {
    const upload1 = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(upload1.url, image));
    const report = await fpm.apply(
      uploadMedia({
        report: reportId,
        variant: 'draft' as ID,
        file: { upload: upload1.id, name: 'asdf' },
      }),
    );
    const media1 = report.media.items[0]!;

    const upload2 = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(upload2.url, image));
    const reportUpdated = await fpm.apply(
      uploadMedia({
        report: reportId,
        variant: 'fpm' as ID,
        variantGroup: media1.variantGroup,
        file: { upload: upload2.id, name: 'asdf' },
      }),
    );

    expect(reportUpdated.media.items).toHaveLength(2);
    expect(reportUpdated.media.total).toBe(2);

    const [m1, m2] = reportUpdated.media.items;
    expect(m1!.variantGroup).toBe(m2!.variantGroup);
  });

  it('Only one variant per group', async () => {
    const upload1 = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(upload1.url, image));
    const report = await fpm.apply(
      uploadMedia({
        report: reportId,
        variant: 'draft' as ID,
        file: { upload: upload1.id, name: 'asdf' },
      }),
    );
    const media1 = report.media.items[0]!;

    const upload2 = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(upload2.url, image));
    await expect(
      fpm.apply(
        uploadMedia({
          report: reportId,
          variant: 'draft' as ID,
          variantGroup: media1.variantGroup,
          file: { upload: upload2.id, name: 'asdf' },
        }),
      ),
    ).rejects.toThrowGqlError({
      code: 'Input',
      field: 'variant',
    });
  });

  it('Delete', async () => {
    const upload = await fpm.apply(requestFileUpload());
    await fpm.apply(uploadFileContents(upload.url, image));

    const report = await fpm.apply(
      uploadMedia({
        report: reportId,
        variant: 'draft' as ID,
        file: {
          upload: upload.id,
          name: 'A picture',
        },
      }),
    );

    const { report: updated } = await fpm.run(
      graphql(
        `
          mutation Delete($id: ID!) {
            report: deleteProgressReportMedia(id: $id) {
              id
              media {
                items {
                  ...reportMedia
                }
                hasMore
                total
              }
            }
          }
        `,
        [reportMediaFrag],
      ),
      { id: report.media.items[0]!.id },
    );

    expect(updated.id).toBe(reportId);
    expect(updated.media.items).toHaveLength(0);
    expect(updated.media.total).toBe(0);
  });

  describe('Featured Media', () => {
    let marketing: IdentifiedTester;
    beforeAll(async () => {
      marketing = await createTesterWithRole(app, 'Marketing');
    });

    it('Upload', async () => {
      const before = await fpm.apply(getFeaturedMedia(reportId));
      expect(before).toBeNull();

      const upload = await marketing.apply(async ({ apply }) => {
        const uploadRequest = await apply(requestFileUpload());
        await apply(uploadFileContents(uploadRequest.url, image));
        return await apply(
          uploadMedia({
            report: reportId,
            variant: 'published' as any,
            file: {
              upload: uploadRequest.id,
              name: 'A picture',
            },
          }),
        );
      });

      const after = await fpm.apply(getFeaturedMedia(reportId));
      expect(after).not.toBeNull();
      expect(after?.id).toEqual(upload.media.items[0]!.id);
    });

    it('Latest Wins', async () => {
      const before = await fpm.apply(getFeaturedMedia(reportId));
      expect(before).toBeNull();

      await marketing.apply(async ({ apply }) => {
        const upload1 = await apply(requestFileUpload());
        await apply(uploadFileContents(upload1.url, image));
        await apply(
          uploadMedia({
            report: reportId,
            variant: 'published' as any,
            file: {
              upload: upload1.id,
              name: 'The picture',
            },
          }),
        );

        const upload2 = await apply(requestFileUpload());
        await apply(uploadFileContents(upload2.url, image));
        await apply(
          uploadMedia({
            report: reportId,
            variant: 'published' as any,
            file: {
              upload: upload2.id,
              name: 'The picture',
              media: {
                caption: 'The latest picture',
              },
            },
          }),
        );
      });

      const after = await fpm.apply(getFeaturedMedia(reportId));
      expect(after).not.toBeNull();
      expect(after?.media.caption).toEqual('The latest picture');
    });

    it('None if not published variant', async () => {
      const upload = await fpm.apply(requestFileUpload());
      await fpm.apply(uploadFileContents(upload.url, image));
      await fpm.apply(
        uploadMedia({
          report: reportId,
          variant: 'draft' as any,
          file: {
            upload: upload.id,
            name: 'A picture',
          },
        }),
      );

      const featured = await fpm.apply(getFeaturedMedia(reportId));
      expect(featured).toBeNull();
    });
  });
});

type UploadMedia = InputOf<typeof UploadMediaDoc>;
const uploadMedia = (input: UploadMedia) => async (tester: Tester) => {
  const { upload } = await tester.run(UploadMediaDoc, { input });
  return upload;
};

const getFeaturedMedia =
  (id: ID<'ProgressReport'>) => async (tester: Tester) => {
    const { report } = await tester.run(
      graphql(
        `
          query GetFeaturedMedia($id: ID!) {
            report: periodicReport(id: $id) {
              __typename
              ... on ProgressReport {
                featuredMedia {
                  ...reportMedia
                }
              }
            }
          }
        `,
        [reportMediaFrag],
      ),
      { id },
    );
    if (report.__typename !== 'ProgressReport') throw new Error();
    return report.featuredMedia;
  };

const reportMediaFrag = graphql(`
  fragment reportMedia on ProgressReportMedia {
    id
    category
    variant {
      key
    }
    variantGroup
    media {
      __typename
      url
      mimeType
      altText
      caption
    }
    canEdit
    canDelete
  }
`);
const UploadMediaDoc = graphql(
  `
    mutation Upload($input: UploadProgressReportMedia!) {
      upload: uploadProgressReportMedia(input: $input) {
        id
        media {
          items {
            ...reportMedia
          }
          hasMore
          total
        }
      }
    }
  `,
  [reportMediaFrag],
);
