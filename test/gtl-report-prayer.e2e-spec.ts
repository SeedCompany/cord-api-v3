import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import {
  createInternshipEngagement,
  createLanguageEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  registerUser,
  type TestApp,
  type TestUser,
} from './utility';

// Prayer on a GTL report (#3970), end to end: a member Field Partner writes a
// prayer request on their Internship engagement for a quarter, the report
// lists what was written for it (and only that), a Project Manager clears
// and finalizes it, Marketing curates it into the Investor Report under the
// per-report cap, and non-members see nothing. The shared mechanics (the
// moderation ladder, the report link) are covered in post-engagement; this
// spec checks that they hold on a GTL report specifically.
describe('GTL Report Prayer e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added to every project created here. */
  let memberFieldPartner: TestUser;
  let marketing: TestUser;
  /** A Project Manager who is never added to a project. PMs can read a GTL
   * report by id and its engagement, so they can ask for the posts — and get
   * a redacted list, since their posts grant is member-conditioned. */
  let outsiderProjectManager: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    // `registerUser` logs the ambient session in as each new user.
    await projectManager.login();
  });

  // Every project gets the four quarters of 2020 as its MOU window, with an
  // engagement whose dates match, so each engagement has reports to write for.
  const window = { start: '2020-01-01', end: '2020-12-31' };

  // An Internship project created by the project manager, who thereby becomes
  // a member; the member field partner is added. Returns the GTL reports, with
  // Q1 and Q2 picked out.
  const createInternship = async () => {
    await projectManager.login();
    const project = await createProject(app, {
      type: 'Internship',
      mouStart: window.start,
      mouEnd: window.end,
    });
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      startDateOverride: window.start,
      endDateOverride: window.end,
    });
    await createProjectMember(app, {
      project: project.id,
      user: memberFieldPartner.id,
      roles: [Role.FieldPartner],
    });
    const reports = await gtlReportsOf(engagement.id);
    const q1 = reports.find((report) => report.start === '2020-01-01');
    const q2 = reports.find((report) => report.start === '2020-04-01');
    if (!q1 || !q2) throw new Error('expected Q1 and Q2 2020 GTL reports');
    return { project, engagement, reports, q1, q2 };
  };

  const gtlReportsOf = async (engagement: ID) => {
    const result = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement,
    });
    return result.engagement.gtlReports.items;
  };

  /** A Progress report on a Language engagement of another project. */
  const createProgressReportElsewhere = async () => {
    await projectManager.login();
    const project = await createProject(app, {
      mouStart: window.start,
      mouEnd: window.end,
    });
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      startDateOverride: window.start,
      endDateOverride: window.end,
    });
    const result = await app.graphql.query(EngagementProgressReportsDoc, {
      id: engagement.id,
    });
    const report = result.engagement.progressReports.items[0];
    if (!report) throw new Error('expected a Progress report');
    return { engagement, report };
  };

  const createPost = async (input: InputOf<typeof CreatePostDoc>) => {
    const result = await app.graphql.mutate(CreatePostDoc, { input });
    return result.createPost.post;
  };

  type PostFields = Awaited<ReturnType<typeof createPost>>;

  /** `updatePost` requires the content fields, so re-send the current ones. */
  const updateInput = (post: PostFields) => ({
    id: post.id,
    type: post.type,
    shareability: post.shareability,
    body: post.body.value!,
  });

  const updatePost = async (input: InputOf<typeof UpdatePostDoc>) => {
    const result = await app.graphql.mutate(UpdatePostDoc, { input });
    return result.updatePost.post;
  };

  const moderate = async (
    id: ID,
    shareability: InputOf<typeof ModeratePostDoc>['shareability'],
  ) => {
    const result = await app.graphql.mutate(ModeratePostDoc, {
      input: { id, shareability },
    });
    return result.moderatePost.posts[0]!;
  };

  const feature = (post: PostFields) =>
    app.graphql.mutate(FeaturePostDoc, {
      input: { ...updateInput(post), featured: true },
    });

  /** `GTLReport.posts` — what was written for this quarter. */
  const reportPosts = async (report: ID) => {
    const result = await app.graphql.query(GtlReportPostsDoc, { id: report });
    const periodicReport = result.periodicReport;
    if (periodicReport.__typename !== 'GTLReport') {
      throw new Error('expected a GTL report');
    }
    return periodicReport.posts;
  };

  /** `InternshipEngagement.posts` — the engagement's whole feed. */
  const engagementPosts = async (engagement: ID) => {
    const result = await app.graphql.query(EngagementPostsDoc, {
      id: engagement,
    });
    return result.internshipEngagement.posts;
  };

  /**
   * The member field partner's prayer request, asking for External reach and
   * submitted with this report. Nobody has cleared it yet.
   */
  const prayerOn = async (engagement: ID, report: ID, body: string) => {
    await memberFieldPartner.login();
    return await createPost({
      parent: engagement,
      type: 'Prayer',
      shareability: 'External',
      body,
      report,
    });
  };

  /** `prayerOn`, then cleared by the project manager to AskToShareExternally. */
  const clearedPrayerOn = async (engagement: ID, report: ID, body: string) => {
    const post = await prayerOn(engagement, report, body);
    await projectManager.login();
    await moderate(post.id, 'AskToShareExternally');
    return post;
  };

  it('a member field partner writes a prayer request for the quarter, and that report alone lists it', async () => {
    const { engagement, q1, q2 } = await createInternship();

    const post = await prayerOn(engagement.id, q1.id, 'Pray for the leader');
    expect(post.type).toBe('Prayer');
    expect(post.report.value?.id).toBe(q1.id);
    expect(post.creator.value?.id).toBe(memberFieldPartner.id);
    // External needs a moderator, so nothing is cleared on the way in.
    expect(post.approvedShareability.value).toBeNull();
    expect(post.effectiveShareability).toBe('Internal');
    expect(post.featured.value).toBe(false);

    const onQ1 = await reportPosts(q1.id);
    expect(onQ1.canRead).toBe(true);
    expect(onQ1.canCreate).toBe(true);
    expect(onQ1.total).toBe(1);
    expect(onQ1.items.map((item) => item.id)).toEqual([post.id]);
    expect(onQ1.items[0]!.body.value).toBe('Pray for the leader');

    // Written for Q1, so the next quarter's report does not list it — the
    // list is readable there, just empty.
    const onQ2 = await reportPosts(q2.id);
    expect(onQ2.canRead).toBe(true);
    expect(onQ2.total).toBe(0);
    expect(onQ2.items).toEqual([]);

    // A request written between reports is in the engagement's feed but on
    // no report, and does not creep into Q1's list.
    const unattached = await createPost({
      parent: engagement.id,
      type: 'Prayer',
      shareability: 'Internal',
      body: 'Between quarters',
    });
    expect(unattached.report.value).toBeNull();
    const feed = await engagementPosts(engagement.id);
    expect(new Set(feed.items.map((item) => item.id))).toEqual(
      new Set([post.id, unattached.id]),
    );
    expect((await reportPosts(q1.id)).items.map((item) => item.id)).toEqual([
      post.id,
    ]);
  });

  it('refuses a Progress report from another engagement', async () => {
    const { engagement } = await createInternship();
    const elsewhere = await createProgressReportElsewhere();

    await memberFieldPartner.login();
    await app.graphql
      .mutate(CreatePostDoc, {
        input: {
          parent: engagement.id,
          type: 'Prayer',
          shareability: 'Internal',
          body: 'Filed under the wrong report',
          report: elsewhere.report.id,
        },
      })
      .expectError(
        errors.input({
          field: 'report',
          message: "Report does not belong to this post's engagement",
        }),
      );
  });

  it('a project manager narrows the reach and sets the wording, then Marketing features it; the field partner cannot', async () => {
    const { engagement, q1 } = await createInternship();

    const post = await prayerOn(engagement.id, q1.id, 'Oren por el líder');
    expect(post.approvedShareability.canEdit).toBe(false);
    expect(post.finalBody.canEdit).toBe(false);
    expect(post.featured.canEdit).toBe(false);

    // Not cleared yet, so Marketing is turned away on the content, not on
    // permission — the negative control for the feature below.
    await marketing.login();
    await feature(post).expectError(
      errors.input({
        field: 'featured',
        message: 'This post has not been cleared to leave Seed Company yet',
      }),
    );

    await projectManager.login();
    const moderated = await moderate(post.id, 'AskToShareExternally');
    expect(moderated.shareability).toBe('External');
    expect(moderated.approvedShareability.value).toBe('AskToShareExternally');
    expect(moderated.approvedShareability.canEdit).toBe(true);
    expect(moderated.approvedBy.value?.id).toBe(projectManager.id);
    expect(moderated.effectiveShareability).toBe('AskToShareExternally');

    const finalized = await updatePost({
      ...updateInput(post),
      finalBody: 'Pray for the leader',
    });
    expect(finalized.body.value).toBe('Oren por el líder');
    expect(finalized.finalBody.value).toBe('Pray for the leader');
    expect(finalized.finalBody.canEdit).toBe(true);
    expect(finalized.effectiveBody).toBe('Pray for the leader');

    await marketing.login();
    const featured = await feature(post);
    expect(featured.updatePost.post.featured.value).toBe(true);
    expect(featured.updatePost.post.featured.canEdit).toBe(true);

    // The report's list carries the curated state and the final wording.
    await projectManager.login();
    const [listed] = (await reportPosts(q1.id)).items;
    expect(listed!.id).toBe(post.id);
    expect(listed!.featured.value).toBe(true);
    expect(listed!.effectiveShareability).toBe('AskToShareExternally');
    expect(listed!.effectiveBody).toBe('Pray for the leader');

    // The author asks for a reach; choosing what the investors see is not
    // theirs — even on a post already cleared to go out.
    const another = await clearedPrayerOn(engagement.id, q1.id, 'Another');
    await memberFieldPartner.login();
    await feature(another).expectError(
      errors.unauthorized({ field: 'post.featured' }),
    );
  });

  it('caps featured posts at three per GTL report', async () => {
    const { engagement, q1, q2 } = await createInternship();

    for (const body of ['One', 'Two', 'Three']) {
      const post = await clearedPrayerOn(engagement.id, q1.id, body);
      await marketing.login();
      const featured = await feature(post);
      expect(featured.updatePost.post.featured.value).toBe(true);
    }

    const fourth = await clearedPrayerOn(engagement.id, q1.id, 'Four');
    await marketing.login();
    await feature(fourth).expectError(
      errors.input({
        field: 'featured',
        message:
          'Up to 3 posts can be featured for the Investor Report per report',
      }),
    );

    // The cap is per report: the next quarter has its own three.
    const nextQuarter = await clearedPrayerOn(
      engagement.id,
      q2.id,
      'Next quarter',
    );
    await marketing.login();
    const featuredNext = await feature(nextQuarter);
    expect(featuredNext.updatePost.post.featured.value).toBe(true);

    // Q1 lists all four it was written for, three of them featured.
    await projectManager.login();
    const listed = await reportPosts(q1.id);
    expect(listed.total).toBe(4);
    expect(listed.items.filter((item) => item.featured.value)).toHaveLength(3);
    expect(
      listed.items.find((item) => item.id === fourth.id)!.featured.value,
    ).toBe(false);
    expect(listed.items.map((item) => item.id)).not.toContain(nextQuarter.id);
  });

  // Reports are soft-deleted and come back under a NEW row id when an
  // engagement's date range shrinks and grows again. `Post.report` follows
  // the period, and so does the report's list — otherwise the re-created
  // quarter would show no prayer requests while each post still claimed it.
  it('lists a post under the re-created report after the date range shrinks and grows back', async () => {
    const { engagement, reports } = await createInternship();
    const q4 = reports.find((report) => report.start === '2020-10-01');
    if (!q4) throw new Error('expected a Q4 2020 GTL report');

    const post = await prayerOn(engagement.id, q4.id, 'Submitted with Q4');

    await projectManager.login();
    await app.graphql.mutate(UpdateEngagementDatesDoc, {
      id: engagement.id,
      endDateOverride: '2020-06-30',
    });
    await app.graphql.mutate(UpdateEngagementDatesDoc, {
      id: engagement.id,
      endDateOverride: window.end,
    });
    const newQ4 = (await gtlReportsOf(engagement.id)).find(
      (report) => report.start === '2020-10-01',
    );
    if (!newQ4) throw new Error('expected Q4 2020 to be re-created');
    expect(newQ4.id).not.toBe(q4.id);

    const listed = await reportPosts(newQ4.id);
    expect(listed.items.map((item) => item.id)).toEqual([post.id]);
    expect(listed.items[0]!.report.value?.id).toBe(newQ4.id);
  });

  describe('who may see the list', () => {
    it('a project manager who is not on the project gets a redacted list', async () => {
      const { project, engagement, q1 } = await createInternship();
      await prayerOn(engagement.id, q1.id, 'For the team to see');

      await outsiderProjectManager.login();
      const redacted = await reportPosts(q1.id);
      expect(redacted.canRead).toBe(false);
      expect(redacted.canCreate).toBe(false);
      expect(redacted.items).toEqual([]);

      // Positive control: on the project, the same person sees the request.
      await projectManager.login();
      await createProjectMember(app, {
        project: project.id,
        user: outsiderProjectManager.id,
        roles: [Role.ProjectManager],
      });
      await outsiderProjectManager.login();
      const asMember = await reportPosts(q1.id);
      expect(asMember.canRead).toBe(true);
      expect(asMember.canCreate).toBe(true);
      expect(asMember.items).toHaveLength(1);
    });

    // Marketing oversees every project without joining any, so their read of
    // the engagement's posts is global — the Prayer step of the investor
    // report depends on it.
    it('Marketing reads the list without being a member, but cannot post', async () => {
      const { engagement, q1 } = await createInternship();
      const post = await prayerOn(engagement.id, q1.id, 'Seen by Marketing');

      await marketing.login();
      const result = await app.graphql.query(GtlReportPostIdsDoc, {
        id: q1.id,
      });
      const report = result.periodicReport;
      if (report.__typename !== 'GTLReport') throw new Error();
      expect(report.posts.canRead).toBe(true);
      expect(report.posts.canCreate).toBe(false);
      expect(report.posts.items.map((item) => item.id)).toEqual([post.id]);
    });
  });
});

const postFields = graphql(`
  fragment gtlPrayerPostFields on Post {
    id
    type
    shareability
    effectiveShareability
    effectiveBody
    approvedAt
    body {
      value
      canEdit
    }
    finalBody {
      value
      canEdit
    }
    approvedShareability {
      value
      canEdit
    }
    featured {
      value
      canEdit
    }
    approvedBy {
      value {
        id
      }
    }
    report {
      value {
        id
      }
    }
    creator {
      value {
        id
      }
    }
  }
`);

const CreatePostDoc = graphql(
  `
    mutation CreateGtlPrayerPost($input: CreatePost!) {
      createPost(input: $input) {
        post {
          ...gtlPrayerPostFields
        }
      }
    }
  `,
  [postFields],
);

const UpdatePostDoc = graphql(
  `
    mutation UpdateGtlPrayerPost($input: UpdatePost!) {
      updatePost(input: $input) {
        post {
          ...gtlPrayerPostFields
        }
      }
    }
  `,
  [postFields],
);

// A smaller selection for the Marketing user, who may not read everything the
// full fragment reaches through (the report, the creator).
const FeaturePostDoc = graphql(`
  mutation FeatureGtlPrayerPost($input: UpdatePost!) {
    updatePost(input: $input) {
      post {
        id
        featured {
          value
          canEdit
        }
      }
    }
  }
`);

const ModeratePostDoc = graphql(
  `
    mutation ModerateGtlPrayerPost($input: ModeratePost!) {
      moderatePost(input: $input) {
        posts {
          ...gtlPrayerPostFields
        }
      }
    }
  `,
  [postFields],
);

const GtlReportPostsDoc = graphql(
  `
    query GtlReportPosts($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on GTLReport {
          posts {
            canRead
            canCreate
            total
            items {
              ...gtlPrayerPostFields
            }
          }
        }
      }
    }
  `,
  [postFields],
);

// Ids only, for the Marketing user — see FeaturePostDoc.
const GtlReportPostIdsDoc = graphql(`
  query GtlReportPostIds($id: ID!) {
    periodicReport(id: $id) {
      __typename
      ... on GTLReport {
        posts {
          canRead
          canCreate
          total
          items {
            id
          }
        }
      }
    }
  }
`);

const EngagementPostsDoc = graphql(`
  query InternshipEngagementPostsForGtlPrayer($id: ID!) {
    internshipEngagement(id: $id) {
      posts {
        canRead
        total
        items {
          id
        }
      }
    }
  }
`);

const EngagementGtlReportsDoc = graphql(`
  query EngagementGtlReportsForPrayer($id: ID!) {
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

const EngagementProgressReportsDoc = graphql(`
  query EngagementProgressReportsForGtlPrayer($id: ID!) {
    engagement: languageEngagement(id: $id) {
      progressReports {
        items {
          id
          start
        }
      }
    }
  }
`);

const UpdateEngagementDatesDoc = graphql(`
  mutation UpdateInternshipEngagementDatesForGtlPrayer(
    $id: ID!
    $endDateOverride: Date
  ) {
    updateInternshipEngagement(
      input: { id: $id, endDateOverride: $endDateOverride }
    ) {
      engagement {
        id
      }
    }
  }
`);
