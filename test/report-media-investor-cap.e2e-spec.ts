import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { ProjectType } from '../src/components/project/dto';
import {
  createInternshipEngagement,
  createLanguage,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  generateFakeFile,
  registerUser,
  requestFileUpload,
  runAsAdmin,
  type TestApp,
  type TestUser,
  updateProject,
  uploadFileContents,
} from './utility';

const CAP_MESSAGE =
  'A report may not have more than 4 media items in the Investor Communications slot';

// The Variant scalar is typed as an ID in the generated client.
const draft = 'draft' as ID;
const translated = 'translated' as ID;
const fpm = 'fpm' as ID;
const published = 'published' as ID;

const times = (n: number) => [...Array(n).keys()];

// Report media for any engagement report (#3965). One resource,
// `ProgressReportMedia`, serves both ProgressReports and GTLReports; the
// public "Investor Communications" slot (`published`) holds at most four live
// items per report; an item can be reused (copied) into another variant of its
// group; and media never attaches to a project-level (Financial/Narrative)
// report. The existing progress-report-media spec covers the rest.
describe('Report media for any engagement report', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added to every project created here. */
  let memberFieldPartner: TestUser;
  /** Never added to a project. */
  let outsiderFieldPartner: TestUser;
  /** A Project Manager who is NOT on the project. */
  let outsiderProjectManager: TestUser;
  let marketing: TestUser;
  let image: ReturnType<typeof generateFakeFile>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    await projectManager.login();

    image = { ...generateFakeFile(), mimeType: 'image/png' };
  });

  // A language engagement on a 2023 project, created by the project manager
  // (who thereby becomes a member); the member field partner is added. Returns
  // the project and its first progress report.
  const createProgressReport = async () => {
    await projectManager.login();
    const project = await createProject(app, {
      mouStart: '2023-01-01',
      mouEnd: '2024-01-01',
    });
    const language = await runAsAdmin(app, createLanguage);
    const { createEng } = await app.graphql.mutate(
      CreateLanguageEngagementDoc,
      { input: { project: project.id, language: language.id } },
    );
    await createProjectMember(app, {
      project: project.id,
      user: memberFieldPartner.id,
      roles: [Role.FieldPartner],
    });
    const reportId = createEng.engagement.progressReports.items[0]!.id;
    return { project, reportId };
  };

  // An internship engagement whose dates match its 2020 project, created by
  // the project manager; the member field partner is added. Returns the Q1
  // GTL report.
  const createGtlReport = async () => {
    await projectManager.login();
    const project = await createProject(app, {
      type: ProjectType.Internship,
      mouStart: '2020-01-01',
      mouEnd: '2020-12-31',
    });
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      startDateOverride: '2020-01-01',
      endDateOverride: '2020-12-31',
    });
    await createProjectMember(app, {
      project: project.id,
      user: memberFieldPartner.id,
      roles: [Role.FieldPartner],
    });
    const result = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement.id,
    });
    const q1 = result.engagement.gtlReports.items.find(
      (report) => report.start === '2020-01-01',
    );
    if (!q1) throw new Error('expected a Q1 2020 GTL report');
    return { project, reportId: q1.id };
  };

  /** Request an upload slot and put the fake image in it, as the current user. */
  const uploadImage = async () => {
    const { id, url } = await requestFileUpload(app);
    await uploadFileContents(app, url, image);
    return id;
  };

  /** A fresh upload for the report in the variant; a new variant group. */
  const mediaInput = async (
    report: ID,
    variant: ID,
    extra: Partial<InputOf<typeof UploadProgressMediaDoc>> = {},
  ): Promise<InputOf<typeof UploadProgressMediaDoc>> => ({
    report,
    variant,
    file: { upload: await uploadImage(), name: 'A picture' },
    ...extra,
  });

  const uploadProgressMedia = async (
    input: InputOf<typeof UploadProgressMediaDoc>,
  ) => {
    const { upload } = await app.graphql.mutate(UploadProgressMediaDoc, {
      input,
    });
    return upload;
  };

  const uploadGtlMedia = async (input: InputOf<typeof UploadGtlMediaDoc>) => {
    const { upload } = await app.graphql.mutate(UploadGtlMediaDoc, { input });
    return upload;
  };

  /** Upload `n` fresh items, one after another; returns the last response. */
  const uploadMany = async <R>(n: number, upload: () => Promise<R>) => {
    const responses: R[] = [];
    for (const _ of times(n)) {
      responses.push(await upload());
    }
    return responses.at(-1)!;
  };

  const itemsIn = (
    report: {
      media: { items: ReadonlyArray<{ id: ID; variant: { key: string } }> };
    },
    variant: ID,
  ) => report.media.items.filter((item) => item.variant.key === variant);

  describe('Investor Communications cap', () => {
    it('a Progress report takes four published items and refuses the fifth', async () => {
      const { reportId } = await createProgressReport();

      await marketing.runAs(async () => {
        const report = await uploadMany(
          4,
          async () =>
            await uploadProgressMedia(await mediaInput(reportId, published)),
        );
        expect(itemsIn(report, published)).toHaveLength(4);

        await app.graphql
          .mutate(UploadProgressMediaDoc, {
            input: await mediaInput(reportId, published),
          })
          .expectError(
            errors.input({ field: 'variant', message: CAP_MESSAGE }),
          );

        // Freeing a slot makes room for one more.
        const removed = itemsIn(report, published)[0]!;
        await app.graphql.mutate(DeleteProgressMediaDoc, { id: removed.id });
        const after = await uploadProgressMedia(
          await mediaInput(reportId, published),
        );
        expect(itemsIn(after, published)).toHaveLength(4);
        expect(after.media.items.map((item) => item.id)).not.toContain(
          removed.id,
        );
      });
    });

    it('the team variants (draft, translated, fpm) are not capped', async () => {
      const { reportId } = await createProgressReport();

      for (const variant of [draft, translated, fpm]) {
        const report = await uploadMany(
          5,
          async () =>
            await uploadProgressMedia(await mediaInput(reportId, variant)),
        );
        expect(itemsIn(report, variant)).toHaveLength(5);
      }
    });

    it('the same cap applies to a GTL report', async () => {
      const { reportId } = await createGtlReport();

      await marketing.runAs(async () => {
        const report = await uploadMany(
          4,
          async () =>
            await uploadGtlMedia(await mediaInput(reportId, published)),
        );
        expect(report.__typename).toBe('GTLReport');
        expect(itemsIn(report, published)).toHaveLength(4);

        await app.graphql
          .mutate(UploadGtlMediaDoc, {
            input: await mediaInput(reportId, published),
          })
          .expectError(
            errors.input({ field: 'variant', message: CAP_MESSAGE }),
          );
      });
    });
  });

  describe('Reuse', () => {
    it('copies a draft item into published within the same variant group', async () => {
      const { reportId } = await createProgressReport();

      const uploaded = await uploadProgressMedia(
        await mediaInput(reportId, draft, {
          category: 'CommunityEngagement',
          file: {
            upload: await uploadImage(),
            name: 'The chosen one',
            media: { altText: 'A fake pic', caption: 'Look it works!' },
          },
        }),
      );
      const source = uploaded.media.items[0]!;

      const reused = await marketing.runAs(async () => {
        const { reuse } = await app.graphql.mutate(ReuseProgressMediaDoc, {
          input: { id: source.id, variant: published },
        });
        return reuse;
      });

      expect(reused.media.total).toBe(2);
      const copy = reused.media.items.find((item) => item.id !== source.id)!;
      expect(copy.variant.key).toBe('published');
      expect(copy.variantGroup).toBe(source.variantGroup);
      expect(copy.category).toBe(source.category);
      expect(copy.media.caption).toBe(source.media.caption);
      expect(copy.media.altText).toBe(source.media.altText);
      expect(copy.media.mimeType).toBe(image.mimeType);
      // Its own file, not a second reference to the source's.
      expect(copy.media.id).not.toBe(source.media.id);
      expect(copy.media.url).not.toBe(source.media.url);
      // Published, so it is the report's featured media.
      expect(reused.featuredMedia?.id).toBe(copy.id);
    });

    it('a reused item counts toward the cap', async () => {
      const { reportId } = await createProgressReport();

      const withDrafts = await uploadMany(
        2,
        async () =>
          await uploadProgressMedia(await mediaInput(reportId, draft)),
      );
      const [firstDraft, secondDraft] = itemsIn(withDrafts, draft);

      await marketing.runAs(async () => {
        await uploadMany(
          3,
          async () =>
            await uploadProgressMedia(await mediaInput(reportId, published)),
        );
        // The fourth published item arrives by reuse.
        const { reuse } = await app.graphql.mutate(ReuseProgressMediaDoc, {
          input: { id: firstDraft!.id, variant: published },
        });
        expect(itemsIn(reuse, published)).toHaveLength(4);

        await app.graphql
          .mutate(ReuseProgressMediaDoc, {
            input: { id: secondDraft!.id, variant: published },
          })
          .expectError(
            errors.input({ field: 'variant', message: CAP_MESSAGE }),
          );
      });
    });

    it('reusing into a variant the group already holds is refused', async () => {
      const { reportId } = await createProgressReport();

      const uploaded = await uploadProgressMedia(
        await mediaInput(reportId, draft),
      );
      const source = uploaded.media.items[0]!;

      await marketing.runAs(async () => {
        await app.graphql.mutate(ReuseProgressMediaDoc, {
          input: { id: source.id, variant: published },
        });
        await app.graphql
          .mutate(ReuseProgressMediaDoc, {
            input: { id: source.id, variant: published },
          })
          .expectError(
            errors.input({
              field: 'variant',
              message: 'Variant group already has this variant',
            }),
          );
      });
    });
  });

  describe('Permissions', () => {
    it('Marketing places into published; a member Field Partner may only use draft', async () => {
      const { reportId } = await createProgressReport();

      await marketing.runAs(async () => {
        const report = await uploadProgressMedia(
          await mediaInput(reportId, published),
        );
        expect(itemsIn(report, published)).toHaveLength(1);
      });

      await memberFieldPartner.runAs(async () => {
        const report = await uploadProgressMedia(
          await mediaInput(reportId, draft),
        );
        expect(itemsIn(report, draft)).toHaveLength(1);

        await app.graphql
          .mutate(UploadProgressMediaDoc, {
            input: await mediaInput(reportId, published),
          })
          .expectError(errors.unauthorized());
      });
    });

    it('non-members are refused on upload and on reuse', async () => {
      const { reportId } = await createProgressReport();
      const uploaded = await uploadProgressMedia(
        await mediaInput(reportId, draft),
      );
      const source = uploaded.media.items[0]!;

      const expectRefused = async (outsider: TestUser) =>
        await outsider.runAs(async () => {
          await app.graphql
            .mutate(UploadProgressMediaDoc, {
              input: await mediaInput(reportId, draft),
            })
            .expectError(errors.unauthorized());
          await app.graphql
            .mutate(ReuseProgressMediaDoc, {
              input: { id: source.id, variant: fpm },
            })
            .expectError(errors.unauthorized());
        });

      await expectRefused(outsiderFieldPartner);
      await expectRefused(outsiderProjectManager);
    });
  });

  describe('GTL report', () => {
    it('a member Field Partner uploads a draft and the report lists it', async () => {
      const { reportId } = await createGtlReport();

      await memberFieldPartner.runAs(async () => {
        const report = await uploadGtlMedia(await mediaInput(reportId, draft));
        expect(report.__typename).toBe('GTLReport');
        expect(report.id).toBe(reportId);

        const { report: read } = await app.graphql.query(GtlReportMediaDoc, {
          id: reportId,
        });
        if (read.__typename !== 'GTLReport') throw new Error();
        expect(read.media.items.map((item) => item.variant.key)).toEqual([
          'draft',
        ]);
        expect(read.media.availableVariants).toContainEqual({
          variant: { key: 'draft' },
          canCreate: true,
        });
        expect(
          read.media.availableVariants.map((v) => v.variant.key),
        ).not.toContain('published');
        // Drafts are not featured.
        expect(read.featuredMedia).toBeNull();
      });
    });

    it('a GTL media item is deleted through the GTL mutation and the report comes back', async () => {
      const { reportId } = await createGtlReport();
      const uploaded = await uploadGtlMedia(await mediaInput(reportId, draft));
      const item = uploaded.media.items[0]!;

      // The Progress-report mutation refuses an item on a GTL report...
      await app.graphql
        .mutate(DeleteProgressMediaDoc, { id: item.id })
        .expectError(errors.input({ field: 'report' }));

      // ...and the GTL one removes it.
      const { report } = await app.graphql.mutate(DeleteGtlMediaDoc, {
        id: item.id,
      });
      expect(report.__typename).toBe('GTLReport');
      expect(report.media.total).toBe(0);
    });
  });

  describe('Only engagement reports take media', () => {
    it('refuses a Financial or Narrative report id', async () => {
      // Project-level reports are generated by the sync that runs when a
      // project's dates CHANGE, so start without dates and then set them
      // (the same recipe as the periodic-report spec). Financial ones also need
      // a report period.
      await projectManager.login();
      const project = await createProject(app);
      await updateProject(app, {
        id: project.id,
        mouStart: '2020-01-01',
        mouEnd: '2020-06-30',
        financialReportPeriod: 'Monthly',
      });
      const { project: reports } = await app.graphql.query(ProjectReportsDoc, {
        id: project.id,
      });
      const financial = reports.financialReports.items[0]?.id;
      const narrative = reports.narrativeReports.items[0]?.id;
      if (!financial || !narrative) {
        throw new Error('expected financial and narrative reports');
      }

      const refused = errors.input({
        field: 'report',
        message: 'Media can only be attached to engagement reports',
      });
      await app.graphql
        .mutate(UploadProgressMediaDoc, {
          input: await mediaInput(financial, draft),
        })
        .expectError(refused);
      await app.graphql
        .mutate(UploadGtlMediaDoc, {
          input: await mediaInput(financial, draft),
        })
        .expectError(refused);
      await app.graphql
        .mutate(UploadProgressMediaDoc, {
          input: await mediaInput(narrative, draft),
        })
        .expectError(refused);
    });

    it('each mutation family refuses the other kind of report', async () => {
      const progress = await createProgressReport();
      const gtl = await createGtlReport();

      await app.graphql
        .mutate(UploadGtlMediaDoc, {
          input: await mediaInput(progress.reportId, draft),
        })
        .expectError(errors.input({ field: 'report' }));
      await app.graphql
        .mutate(UploadProgressMediaDoc, {
          input: await mediaInput(gtl.reportId, draft),
        })
        .expectError(errors.input({ field: 'report' }));
    });
  });
});

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
      id
      url
      mimeType
      altText
      caption
    }
    canEdit
    canDelete
  }
`);

const UploadProgressMediaDoc = graphql(
  `
    mutation UploadProgressMedia($input: UploadProgressReportMedia!) {
      upload: uploadProgressReportMedia(input: $input) {
        __typename
        id
        media {
          items {
            ...reportMedia
          }
          total
        }
      }
    }
  `,
  [reportMediaFrag],
);

const UploadGtlMediaDoc = graphql(
  `
    mutation UploadGtlMedia($input: UploadProgressReportMedia!) {
      upload: uploadGtlReportMedia(input: $input) {
        __typename
        id
        media {
          items {
            ...reportMedia
          }
          total
        }
      }
    }
  `,
  [reportMediaFrag],
);

const ReuseProgressMediaDoc = graphql(
  `
    mutation ReuseProgressMedia($input: ReuseProgressReportMedia!) {
      reuse: reuseProgressReportMedia(input: $input) {
        id
        media {
          items {
            ...reportMedia
          }
          total
        }
        featuredMedia {
          id
        }
      }
    }
  `,
  [reportMediaFrag],
);

const DeleteProgressMediaDoc = graphql(`
  mutation DeleteProgressMedia($id: ID!) {
    report: deleteProgressReportMedia(id: $id) {
      id
      media {
        total
      }
    }
  }
`);

const DeleteGtlMediaDoc = graphql(`
  mutation DeleteGtlMedia($id: ID!) {
    report: deleteGtlReportMedia(id: $id) {
      __typename
      id
      media {
        total
      }
    }
  }
`);

const GtlReportMediaDoc = graphql(`
  query GtlReportMedia($id: ID!) {
    report: periodicReport(id: $id) {
      __typename
      ... on GTLReport {
        media {
          items {
            id
            variant {
              key
            }
          }
          availableVariants {
            variant {
              key
            }
            canCreate
          }
        }
        featuredMedia {
          id
        }
      }
    }
  }
`);

const CreateLanguageEngagementDoc = graphql(`
  mutation CreateLanguageEngagementForMedia($input: CreateLanguageEngagement!) {
    createEng: createLanguageEngagement(input: $input) {
      engagement {
        id
        progressReports(input: { count: 1 }) {
          items {
            id
          }
        }
      }
    }
  }
`);

const EngagementGtlReportsDoc = graphql(`
  query EngagementGtlReportsForMedia($id: ID!) {
    engagement: internshipEngagement(id: $id) {
      gtlReports {
        items {
          id
          start
        }
      }
    }
  }
`);

const ProjectReportsDoc = graphql(`
  query ProjectLevelReports($id: ID!) {
    project(id: $id) {
      financialReports {
        items {
          id
        }
      }
      narrativeReports {
        items {
          id
        }
      }
    }
  }
`);
