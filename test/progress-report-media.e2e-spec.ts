import { type Merge } from 'type-fest';
import {
  CalendarDate,
  type IdOf,
  isIdLike,
  type PaginatedListType,
  type Variant,
} from '~/common';
import { type CreateLanguageEngagement } from '../src/components/engagement/dto';
import { type Media } from '../src/components/file/media/media.dto';
import { type Language } from '../src/components/language/dto';
import { type ProgressReport } from '../src/components/progress-report/dto';
import {
  type MediaVariant,
  type ProgressReportMedia,
  type UpdateProgressReportMedia,
  type UploadProgressReportMedia,
} from '../src/components/progress-report/media/dto';
import {
  createLanguage,
  createProject,
  createSession,
  createTestApp,
  fragments,
  generateFakeFile,
  gql,
  type Raw,
  registerUser,
  requestFileUpload,
  runAsAdmin,
  runInIsolatedSession,
  type TestApp,
  type TestUser,
  uploadFileContents,
} from './utility';
import { type RawProject } from './utility/fragments';

describe('ProgressReport Media e2e', () => {
  let app: TestApp;
  let project: RawProject;
  let language: Language;
  let reportId: IdOf<ProgressReport>;
  let image: ReturnType<typeof generateFakeFile>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: ['ProjectManager'] });

    project = await createProject(app, {
      mouStart: CalendarDate.local(2023, 1, 1),
      mouEnd: CalendarDate.local(2024, 1, 1),
    });

    image = {
      ...generateFakeFile(),
      mimeType: 'image/png',
    };
  });

  beforeEach(async () => {
    language = await runAsAdmin(app, createLanguage);

    const { createEng } = await app.graphql.mutate(
      gql`
        mutation CreateLanguageEngagement($input: CreateLanguageEngagement!) {
          createEng: createLanguageEngagement(input: { engagement: $input }) {
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
        ${fragments.languageEngagement}
      `,
      {
        input: {
          projectId: project.id,
          languageId: language.id,
        } satisfies CreateLanguageEngagement,
      },
    );
    reportId = createEng.engagement.progressReports.items[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('View uploadable options', async () => {
    const { report } = await app.graphql.query(
      gql`
        query ($id: ID!) {
          report: periodicReport(id: $id) {
            ... on ProgressReport {
              media {
                uploadableVariants {
                  key
                }
              }
            }
          }
        }
      `,
      { id: reportId },
    );
    const { uploadableVariants } = report.media;
    const keys = uploadableVariants.map((v: Variant) => v.key);
    expect(keys).toEqual(['draft', 'translated', 'fpm']);
  });

  it('Upload', async () => {
    const { id: uploadId, url } = await requestFileUpload(app);
    await uploadFileContents(app, url, image);

    const input = {
      reportId,
      variant: 'draft' as any,
      category: 'CommunityEngagement',
      file: {
        uploadId,
        name: 'A picture',
        media: {
          altText: 'A fake pic',
          caption: 'Look it works!',
        },
      },
    } satisfies UploadProgressReportMedia;
    const upload = await uploadMedia(app, input);

    expect(upload.id).toBe(reportId);
    expect(upload.media.items).toHaveLength(1);
    expect(upload.media.hasMore).toBeFalsy();
    expect(upload.media.total).toBe(1);

    const reportMedia = upload.media.items[0];
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
    const { id: uploadId, url } = await requestFileUpload(app);
    await uploadFileContents(app, url, image);
    const report = await uploadMedia(app, {
      reportId,
      variant: 'draft',
      category: 'CommunityEngagement',
      file: {
        uploadId,
        name: 'A picture',
        media: {
          altText: 'A fake pic',
          caption: 'Look it works!',
        },
      },
    });

    const input = {
      id: report.media.items[0]!.id as IdOf<ProgressReportMedia>,
      category: 'WorkInProgress',
      altText: 'Actually a cat',
      caption: 'This it updates!',
    } satisfies UpdateProgressReportMedia;
    const { update } = await app.graphql.mutate(
      gql`
        mutation Update($input: UpdateProgressReportMedia!) {
          update: updateProgressReportMedia(input: $input) {
            ...reportMedia
          }
        }
        ${reportMediaFrag}
      `,
      { input },
    );

    expect(update.category).toBe(input.category);
    expect(update.media.altText).toBe(input.altText);
    expect(update.media.caption).toBe(input.caption);
    expect(update.media.mimeType).toBe(image.mimeType);
  });

  it('Upload another variant in group', async () => {
    const upload1 = await requestFileUpload(app);
    await uploadFileContents(app, upload1.url, image);
    const report = await uploadMedia(app, {
      reportId,
      variant: 'draft',
      file: { uploadId: upload1.id, name: 'asdf' },
    });
    const media1 = report.media.items[0]!;

    const upload2 = await requestFileUpload(app);
    await uploadFileContents(app, upload2.url, image);
    const reportUpdated = await uploadMedia(app, {
      reportId,
      variant: 'fpm',
      variantGroup: media1.variantGroup,
      file: { uploadId: upload2.id, name: 'asdf' },
    });

    expect(reportUpdated.media.items).toHaveLength(2);
    expect(reportUpdated.media.total).toBe(2);

    const [m1, m2] = reportUpdated.media.items;
    expect(m1.variantGroup).toBe(m2.variantGroup);
  });

  it('Only one variant per group', async () => {
    const upload1 = await requestFileUpload(app);
    await uploadFileContents(app, upload1.url, image);
    const report = await uploadMedia(app, {
      reportId,
      variant: 'draft',
      file: { uploadId: upload1.id, name: 'asdf' },
    });
    const media1 = report.media.items[0]!;

    const upload2 = await requestFileUpload(app);
    await uploadFileContents(app, upload2.url, image);
    await expect(
      uploadMedia(app, {
        reportId,
        variant: 'draft',
        variantGroup: media1.variantGroup,
        file: { uploadId: upload2.id, name: 'asdf' },
      }),
    ).rejects.toThrowGqlError({
      code: 'Input',
      field: 'variant',
    });
  });

  it('Delete', async () => {
    const { id: uploadId, url } = await requestFileUpload(app);
    await uploadFileContents(app, url, image);

    const report = await uploadMedia(app, {
      reportId,
      variant: 'draft',
      file: {
        uploadId,
        name: 'A picture',
      },
    });

    const { report: updated } = await app.graphql.mutate(
      gql`
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
        ${reportMediaFrag}
      `,
      { id: report.media.items[0]!.id },
    );

    expect(updated.id).toBe(reportId);
    expect(updated.media.items).toHaveLength(0);
    expect(updated.media.total).toBe(0);
  });

  describe('Featured Media', () => {
    let marketing: TestUser;
    beforeAll(async () => {
      marketing = await runInIsolatedSession(app, async () => {
        return await registerUser(app, { roles: ['Marketing'] });
      });
    });

    it('Upload', async () => {
      const before = await getFeaturedMedia(app, reportId);
      expect(before).toBeNull();

      const upload = await runInIsolatedSession(app, async () => {
        await marketing.login();

        const { id: uploadId, url } = await requestFileUpload(app);
        await uploadFileContents(app, url, image);
        return await uploadMedia(app, {
          reportId,
          variant: 'published' as any,
          file: {
            uploadId,
            name: 'A picture',
          },
        });
      });

      const after = await getFeaturedMedia(app, reportId);
      expect(after).not.toBeNull();
      expect(after?.id).toEqual(upload.media.items[0].id);
    });

    it('Latest Wins', async () => {
      const before = await getFeaturedMedia(app, reportId);
      expect(before).toBeNull();

      await runInIsolatedSession(app, async () => {
        await marketing.login();

        const upload1 = await requestFileUpload(app);
        await uploadFileContents(app, upload1.url, image);
        await uploadMedia(app, {
          reportId,
          variant: 'published' as any,
          file: {
            uploadId: upload1.id,
            name: 'The picture',
          },
        });

        const upload2 = await requestFileUpload(app);
        await uploadFileContents(app, upload2.url, image);
        await uploadMedia(app, {
          reportId,
          variant: 'published' as any,
          file: {
            uploadId: upload2.id,
            name: 'The picture',
            media: {
              caption: 'The latest picture',
            },
          },
        });
      });

      const after = await getFeaturedMedia(app, reportId);
      expect(after).not.toBeNull();
      expect(after?.media.caption).toEqual('The latest picture');
    });

    it('None if not published variant', async () => {
      const { id: uploadId, url } = await requestFileUpload(app);
      await uploadFileContents(app, url, image);
      await uploadMedia(app, {
        reportId,
        variant: 'draft' as any,
        file: {
          uploadId,
          name: 'A picture',
        },
      });

      const featured = await getFeaturedMedia(app, reportId);
      expect(featured).toBeNull();
    });
  });
});

async function uploadMedia(
  app: TestApp,
  input: Merge<UploadProgressReportMedia, { variant: MediaVariant }>,
) {
  const { upload } = await app.graphql.mutate(
    gql`
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
      ${reportMediaFrag}
    `,
    { input },
  );
  return upload as {
    id: IdOf<ProgressReport>;
    media: PaginatedListType<RawReportMedia>;
  };
}

async function getFeaturedMedia(app: TestApp, id: IdOf<ProgressReport>) {
  const { report } = await app.graphql.query(
    gql`
      query ($id: ID!) {
        report: periodicReport(id: $id) {
          ... on ProgressReport {
            featuredMedia {
              ...reportMedia
            }
          }
        }
      }
      ${reportMediaFrag}
    `,
    { id },
  );
  return report.featuredMedia as RawReportMedia | null;
}

const reportMediaFrag = gql`
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
`;
type RawReportMedia = Omit<
  Raw<ProgressReportMedia>,
  'media' | 'file' | 'creator' | 'scope'
> & {
  media: Raw<Media>;
  canEdit: boolean;
};
