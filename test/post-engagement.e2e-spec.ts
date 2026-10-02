import { beforeAll, describe, expect, it } from '@jest/globals';
import { generateId, type ID, Role } from '~/common';
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

// Prayer requests (and other posts) on engagements — the feed shared by the
// Progress and GTL reports (#3964): posting as a project member on either
// kind of engagement, attaching a post to one of the engagement's quarterly
// reports, the moderation ladder (requested vs cleared reach), the finalized
// wording, and curating a cleared post into the Investor Report.
describe('Posts on engagements e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added as a member to every project created here. */
  let fieldPartner: TestUser;
  let marketing: TestUser;
  /** A Project Manager who is never added to a project. PMs can read
   * engagements, so they can ask for the posts and get a redacted list. */
  let outsiderProjectManager: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    fieldPartner = await registerUser(app, { roles: [Role.FieldPartner] });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    // `registerUser` logs the ambient session in as each new user.
    await projectManager.login();
  });

  // Both kinds of project get the four quarters of 2020 as their MOU window,
  // with an engagement whose dates match, so each engagement has reports to
  // attach posts to. Created by the project manager, who thereby becomes a
  // member; the field partner is added as one.
  const window = { start: '2020-01-01', end: '2020-12-31' };

  const createLanguageSide = async () => {
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
    await createProjectMember(app, {
      project: project.id,
      user: fieldPartner.id,
      roles: [Role.FieldPartner],
    });
    const result = await app.graphql.query(LanguageEngagementReportsDoc, {
      id: engagement.id,
    });
    const reports = result.languageEngagement.progressReports.items;
    expect(reports.length).toBeGreaterThan(1);
    return { project, engagement, reports };
  };

  const createInternshipSide = async () => {
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
      user: fieldPartner.id,
      roles: [Role.FieldPartner],
    });
    const result = await app.graphql.query(InternshipEngagementReportsDoc, {
      id: engagement.id,
    });
    const reports = result.internshipEngagement.gtlReports.items;
    expect(reports.length).toBeGreaterThan(1);
    return { project, engagement, reports };
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

  const languagePosts = async (id: ID) => {
    const result = await app.graphql.query(LanguageEngagementPostsDoc, { id });
    return result.languageEngagement.posts;
  };

  const internshipPosts = async (id: ID) => {
    const result = await app.graphql.query(InternshipEngagementPostsDoc, {
      id,
    });
    return result.internshipEngagement.posts;
  };

  describe('posting on an engagement', () => {
    // One grant on the Engagement interface has to reach BOTH concrete types.
    // The engine drops an interface grant for a concrete type whenever the
    // same policy names that type, so this checks the grant actually landed on
    // each — a Language engagement alone would pass if Internship were missed.
    it('a project manager who is a member posts on a LanguageEngagement and an InternshipEngagement and reads both back', async () => {
      const language = await createLanguageSide();
      const internship = await createInternshipSide();

      const onLanguage = await createPost({
        parent: language.engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Pray for the translation team',
      });
      expect(onLanguage.type).toBe('Prayer');
      expect(onLanguage.body.value).toBe('Pray for the translation team');
      expect(onLanguage.creator.value?.id).toBe(projectManager.id);
      expect(onLanguage.report.value).toBeNull();
      expect(onLanguage.featured.value).toBe(false);
      // Internal never leaves Seed Company, so it is cleared on creation.
      expect(onLanguage.approvedShareability.value).toBe('Internal');
      expect(onLanguage.approvedAt).toBeTruthy();
      expect(onLanguage.approvedBy.value).toBeNull();
      expect(onLanguage.effectiveShareability).toBe('Internal');
      expect(onLanguage.effectiveBody).toBe('Pray for the translation team');

      const onInternship = await createPost({
        parent: internship.engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Pray for the leader',
      });

      const languageList = await languagePosts(language.engagement.id);
      expect(languageList.canRead).toBe(true);
      expect(languageList.canCreate).toBe(true);
      expect(languageList.items.map((post) => post.id)).toEqual([
        onLanguage.id,
      ]);

      const internshipList = await internshipPosts(internship.engagement.id);
      expect(internshipList.canRead).toBe(true);
      expect(internshipList.canCreate).toBe(true);
      expect(internshipList.items.map((post) => post.id)).toEqual([
        onInternship.id,
      ]);

      // Posts don't leak across parents.
      expect(languageList.items.map((post) => post.id)).not.toContain(
        onInternship.id,
      );

      // The member field partner reads both too, by the same interface grant.
      await fieldPartner.login();
      const asPartnerOnLanguage = await languagePosts(language.engagement.id);
      expect(asPartnerOnLanguage.canCreate).toBe(true);
      expect(asPartnerOnLanguage.items.map((post) => post.id)).toEqual([
        onLanguage.id,
      ]);
      const asPartnerOnInternship = await internshipPosts(
        internship.engagement.id,
      );
      expect(asPartnerOnInternship.items.map((post) => post.id)).toEqual([
        onInternship.id,
      ]);
    });

    it('a Membership post on an engagement is visible to the project members', async () => {
      const { engagement } = await createLanguageSide();

      await fieldPartner.login();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'Membership',
        body: 'Just for the team',
      });
      // The author sees it in the list — the filter resolves membership
      // through the engagement's project, not against the engagement id.
      const asAuthor = await languagePosts(engagement.id);
      expect(asAuthor.items.map((it) => it.id)).toContain(post.id);

      // So does another member.
      await projectManager.login();
      const asManager = await languagePosts(engagement.id);
      expect(asManager.items.map((it) => it.id)).toContain(post.id);
      const byId = await app.graphql.query(PostDoc, { id: post.id });
      expect(byId.post.body.value).toBe('Just for the team');
    });

    it('a project manager who is not a member can neither post nor see the posts', async () => {
      const { engagement } = await createLanguageSide();
      await createPost({
        parent: engagement.id,
        type: 'Note',
        shareability: 'Internal',
        body: 'Members can see this',
      });

      await outsiderProjectManager.login();
      await app.graphql
        .mutate(CreatePostDoc, {
          input: {
            parent: engagement.id,
            type: 'Prayer',
            shareability: 'Internal',
            body: 'Should not be allowed',
          },
        })
        .expectError(errors.unauthorized());

      const redacted = await languagePosts(engagement.id);
      expect(redacted.canRead).toBe(false);
      expect(redacted.canCreate).toBe(false);
      expect(redacted.items).toEqual([]);
    });
  });

  describe('attaching a post to a report', () => {
    it('attaches to a report on its own engagement and refuses one from another engagement', async () => {
      const own = await createLanguageSide();
      const other = await createInternshipSide();
      const [firstReport, secondReport] = own.reports;

      const post = await createPost({
        parent: own.engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Submitted with the quarter',
        report: firstReport!.id,
      });
      expect(post.report.value?.id).toBe(firstReport!.id);

      await app.graphql
        .mutate(CreatePostDoc, {
          input: {
            parent: own.engagement.id,
            type: 'Prayer',
            shareability: 'Internal',
            body: 'Wrong engagement',
            report: other.reports[0]!.id,
          },
        })
        .expectError(
          errors.input({
            field: 'report',
            message: "Report does not belong to this post's engagement",
          }),
        );

      // Moving it to another quarter of the same engagement is fine...
      const moved = await updatePost({
        ...updateInput(post),
        report: secondReport!.id,
      });
      expect(moved.report.value?.id).toBe(secondReport!.id);

      // ...another engagement's report is refused on update too...
      await app.graphql
        .mutate(UpdatePostDoc, {
          input: { ...updateInput(post), report: other.reports[0]!.id },
        })
        .expectError(errors.input({ field: 'report' }));

      // ...and an explicit null detaches without deleting.
      const detached = await updatePost({ ...updateInput(post), report: null });
      expect(detached.report.value).toBeNull();
      expect(detached.body.value).toBe('Submitted with the quarter');
    });

    // Reports are soft-deleted and come back under a NEW row id when an
    // engagement's date range shrinks and grows again (the dead row keeps the
    // deterministic id). The post's link follows the PERIOD, so it lands on
    // the re-created report rather than dangling.
    it('follows the report to its re-created row after the date range shrinks and grows back', async () => {
      const { engagement, reports } = await createInternshipSide();
      const q4 = reports.find((report) => report.start === '2020-10-01')!;
      expect(q4).toBeTruthy();

      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Submitted with Q4',
        report: q4.id,
      });
      expect(post.report.value?.id).toBe(q4.id);

      // Shrink: Q4 is gone (soft-deleted), so the post shows no report.
      await app.graphql.mutate(UpdateInternshipEngagementDatesDoc, {
        id: engagement.id,
        endDateOverride: '2020-06-30',
      });
      const whileGone = await app.graphql.query(PostDoc, { id: post.id });
      expect(whileGone.post.report.value).toBeNull();

      // Grow back: Q4 is re-created under a new id, and the post follows.
      await app.graphql.mutate(UpdateInternshipEngagementDatesDoc, {
        id: engagement.id,
        endDateOverride: window.end,
      });
      const after = await app.graphql.query(InternshipEngagementReportsDoc, {
        id: engagement.id,
      });
      const newQ4 = after.internshipEngagement.gtlReports.items.find(
        (report) => report.start === '2020-10-01',
      )!;
      expect(newQ4.id).not.toBe(q4.id);
      const whenBack = await app.graphql.query(PostDoc, { id: post.id });
      expect(whenBack.post.report.value?.id).toBe(newQ4.id);
    });
  });

  describe('moderation', () => {
    it('a moderator narrows an External request to AskToShareExternally', async () => {
      const { engagement } = await createLanguageSide();

      await fieldPartner.login();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'External',
        body: 'Please share this widely',
      });
      // Nobody has looked yet: readable internally, no wider.
      expect(post.approvedShareability.value).toBeNull();
      expect(post.approvedShareability.canEdit).toBe(false);
      expect(post.approvedBy.value).toBeNull();
      expect(post.effectiveShareability).toBe('Internal');

      await projectManager.login();
      const moderated = await moderate(post.id, 'AskToShareExternally');
      expect(moderated.shareability).toBe('External');
      expect(moderated.approvedShareability.value).toBe('AskToShareExternally');
      expect(moderated.approvedShareability.canEdit).toBe(true);
      expect(moderated.approvedBy.value?.id).toBe(projectManager.id);
      expect(moderated.approvedAt).toBeTruthy();
      expect(moderated.effectiveShareability).toBe('AskToShareExternally');
      // The author's request is untouched.
      expect(moderated.body.value).toBe('Please share this widely');
    });

    it('refuses to clear a post wider than its author asked for', async () => {
      const { engagement } = await createLanguageSide();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Keep this internal',
      });

      await app.graphql
        .mutate(ModeratePostDoc, {
          input: { id: post.id, shareability: 'External' },
        })
        .expectError(
          errors.input({
            field: 'shareability',
            message:
              'Cannot clear a post wider than its author asked for (requested Internal)',
          }),
        );
      // Confirming exactly what was asked for is fine.
      const confirmed = await moderate(post.id, 'Internal');
      expect(confirmed.approvedShareability.value).toBe('Internal');
      expect(confirmed.approvedBy.value?.id).toBe(projectManager.id);
    });

    it('clears several at once, and refuses the whole batch when one is missing', async () => {
      const { engagement } = await createLanguageSide();
      const first = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'External',
        body: 'First',
      });
      const second = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'External',
        body: 'Second',
      });

      await app.graphql
        .mutate(ModeratePostsDoc, {
          input: {
            ids: [first.id, await generateId()],
            shareability: 'Internal',
          },
        })
        .expectError(
          errors.notFound({
            field: 'ids',
            message: 'Could not find every post',
          }),
        );

      const { moderatePosts } = await app.graphql.mutate(ModeratePostsDoc, {
        input: { ids: [first.id, second.id], shareability: 'External' },
      });
      expect(
        moderatePosts.posts.map((post) => post.approvedShareability.value),
      ).toEqual(['External', 'External']);
    });

    it('the author (a field partner) cannot moderate their own post', async () => {
      const { engagement } = await createLanguageSide();
      await fieldPartner.login();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'External',
        body: 'Trying to self-approve',
      });
      await app.graphql
        .mutate(ModeratePostDoc, {
          input: { id: post.id, shareability: 'External' },
        })
        .expectError(errors.unauthorized());
    });

    it('raising the requested reach of an approved post resets the approval; lowering it self-clears', async () => {
      const { engagement } = await createLanguageSide();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Starts internal',
      });
      expect(post.approvedShareability.value).toBe('Internal');

      const raised = await updatePost({
        ...updateInput(post),
        shareability: 'External',
      });
      expect(raised.shareability).toBe('External');
      expect(raised.approvedShareability.value).toBeNull();
      expect(raised.approvedBy.value).toBeNull();
      expect(raised.approvedAt).toBeNull();
      expect(raised.effectiveShareability).toBe('Internal');

      // Cleared at AskToShareExternally. Editing the words alone leaves the
      // clearance standing — only the requested reach re-opens the question.
      await moderate(post.id, 'AskToShareExternally');
      const reworded = await updatePost({
        ...updateInput(raised),
        body: 'Edited and still asking for External',
      });
      expect(reworded.approvedShareability.value).toBe('AskToShareExternally');
      expect(reworded.effectiveShareability).toBe('AskToShareExternally');

      // Any change to a reach that needs a moderator resets the clearance,
      // even this one down to exactly what was cleared: it is a new request.
      const rerequested = await updatePost({
        ...updateInput(reworded),
        shareability: 'AskToShareExternally',
      });
      expect(rerequested.approvedShareability.value).toBeNull();
      expect(rerequested.approvedBy.value).toBeNull();
      expect(rerequested.effectiveShareability).toBe('Internal');

      // Narrowing to a reach that never needed review clears it at that
      // reach, the way a fresh post would be.
      const lowered = await updatePost({
        ...updateInput(rerequested),
        shareability: 'Internal',
      });
      expect(lowered.approvedShareability.value).toBe('Internal');
      expect(lowered.approvedBy.value).toBeNull();
      expect(lowered.effectiveShareability).toBe('Internal');
    });
  });

  describe('final wording', () => {
    it('a moderator sets the wording shown; the body stays the author’s', async () => {
      const { engagement } = await createLanguageSide();

      await fieldPartner.login();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Oremos por el equipo',
      });
      expect(post.finalBody.value).toBeNull();
      expect(post.finalBody.canEdit).toBe(false);
      expect(post.effectiveBody).toBe('Oremos por el equipo');

      // The author may not finalize their own wording.
      await app.graphql
        .mutate(UpdatePostDoc, {
          input: { ...updateInput(post), finalBody: 'My own final say' },
        })
        .expectError(errors.unauthorized({ field: 'post.finalBody' }));

      await projectManager.login();
      const finalized = await updatePost({
        ...updateInput(post),
        finalBody: 'Pray for the team',
      });
      expect(finalized.body.value).toBe('Oremos por el equipo');
      expect(finalized.finalBody.value).toBe('Pray for the team');
      expect(finalized.finalBody.canEdit).toBe(true);
      expect(finalized.effectiveBody).toBe('Pray for the team');

      // The moderator may not rewrite the author's own words...
      await app.graphql
        .mutate(UpdatePostDoc, {
          input: { ...updateInput(post), body: 'Rewritten by a moderator' },
        })
        .expectError(errors.unauthorized({ field: 'post.body' }));

      // ...while the author still edits them without disturbing the final
      // wording, and an explicit null clears it back to the body.
      await fieldPartner.login();
      const edited = await updatePost({
        ...updateInput(post),
        body: 'Oremos por todo el equipo',
      });
      expect(edited.body.value).toBe('Oremos por todo el equipo');
      expect(edited.finalBody.value).toBe('Pray for the team');
      expect(edited.effectiveBody).toBe('Pray for the team');

      await projectManager.login();
      const cleared = await updatePost({
        ...updateInput(post),
        body: 'Oremos por todo el equipo',
        finalBody: null,
      });
      expect(cleared.finalBody.value).toBeNull();
      expect(cleared.effectiveBody).toBe('Oremos por todo el equipo');
    });
  });

  describe('featuring for the Investor Report', () => {
    /** A field partner's External request on this report, cleared by the PM. */
    const clearedPostOn = async (engagement: ID, report: ID, body: string) => {
      await fieldPartner.login();
      const post = await createPost({
        parent: engagement,
        type: 'Prayer',
        shareability: 'External',
        body,
        report,
      });
      await projectManager.login();
      await moderate(post.id, 'AskToShareExternally');
      return post;
    };

    const feature = (post: PostFields) =>
      app.graphql.mutate(FeaturePostDoc, {
        input: { ...updateInput(post), featured: true },
      });

    it('Marketing and a Project Manager can feature a cleared post with a report; a Field Partner cannot', async () => {
      const { engagement, reports } = await createLanguageSide();
      const report = reports[0]!.id;

      const first = await clearedPostOn(engagement.id, report, 'First');
      await marketing.login();
      const byMarketing = await feature(first);
      expect(byMarketing.updatePost.post.featured.value).toBe(true);
      expect(byMarketing.updatePost.post.featured.canEdit).toBe(true);

      const second = await clearedPostOn(engagement.id, report, 'Second');
      await projectManager.login();
      const byManager = await feature(second);
      expect(byManager.updatePost.post.featured.value).toBe(true);

      const third = await clearedPostOn(engagement.id, report, 'Third');
      await fieldPartner.login();
      await feature(third).expectError(
        errors.unauthorized({ field: 'post.featured' }),
      );
      expect(third.featured.canEdit).toBe(false);
    });

    it('refuses to feature a post without a report', async () => {
      const { engagement } = await createLanguageSide();
      await fieldPartner.login();
      const post = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'External',
        body: 'No report',
      });
      await projectManager.login();
      await moderate(post.id, 'AskToShareExternally');

      await feature(post).expectError(
        errors.input({
          field: 'featured',
          message:
            'Only posts submitted with a report can be featured for the Investor Report',
        }),
      );
    });

    it('refuses to feature a post not yet cleared to leave Seed Company', async () => {
      const { engagement, reports } = await createLanguageSide();
      await fieldPartner.login();
      const awaitingReview = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'External',
        body: 'Awaiting review',
        report: reports[0]!.id,
      });
      const internalOnly = await createPost({
        parent: engagement.id,
        type: 'Prayer',
        shareability: 'Internal',
        body: 'Internal only',
        report: reports[0]!.id,
      });

      await projectManager.login();
      for (const post of [awaitingReview, internalOnly]) {
        await feature(post).expectError(
          errors.input({
            field: 'featured',
            message: 'This post has not been cleared to leave Seed Company yet',
          }),
        );
      }
    });

    it('caps featured posts at three per report', async () => {
      const { engagement, reports } = await createLanguageSide();
      const [report, otherReport] = reports;

      const featuredPosts: PostFields[] = [];
      for (const body of ['One', 'Two', 'Three']) {
        const post = await clearedPostOn(engagement.id, report!.id, body);
        await projectManager.login();
        const featured = await feature(post);
        expect(featured.updatePost.post.featured.value).toBe(true);
        featuredPosts.push(post);
      }

      const fourth = await clearedPostOn(engagement.id, report!.id, 'Four');
      await projectManager.login();
      await feature(fourth).expectError(
        errors.input({
          field: 'featured',
          message:
            'Up to 3 posts can be featured for the Investor Report per report',
        }),
      );

      // The cap is per report, so another quarter still has room.
      const elsewhere = await clearedPostOn(
        engagement.id,
        otherReport!.id,
        'Another quarter',
      );
      await projectManager.login();
      const featuredElsewhere = await feature(elsewhere);
      expect(featuredElsewhere.updatePost.post.featured.value).toBe(true);

      // Un-featuring one frees a slot for the fourth.
      const unfeatured = await updatePost({
        ...updateInput(featuredPosts[0]!),
        featured: false,
      });
      expect(unfeatured.featured.value).toBe(false);
      const nowFeatured = await feature(fourth);
      expect(nowFeatured.updatePost.post.featured.value).toBe(true);
    });
  });
});

const postFields = graphql(`
  fragment engagementPostFields on Post {
    id
    type
    shareability
    effectiveShareability
    effectiveBody
    approvedAt
    modifiedAt
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
    mutation CreateEngagementPost($input: CreatePost!) {
      createPost(input: $input) {
        post {
          ...engagementPostFields
        }
      }
    }
  `,
  [postFields],
);

const UpdatePostDoc = graphql(
  `
    mutation UpdateEngagementPost($input: UpdatePost!) {
      updatePost(input: $input) {
        post {
          ...engagementPostFields
        }
      }
    }
  `,
  [postFields],
);

// A smaller selection for the Marketing user, who may not read everything the
// full fragment reaches through (the report, the creator).
const FeaturePostDoc = graphql(`
  mutation FeatureEngagementPost($input: UpdatePost!) {
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
    mutation ModerateEngagementPost($input: ModeratePost!) {
      moderatePost(input: $input) {
        posts {
          ...engagementPostFields
        }
      }
    }
  `,
  [postFields],
);

const ModeratePostsDoc = graphql(`
  mutation ModerateEngagementPosts($input: ModeratePosts!) {
    moderatePosts(input: $input) {
      posts {
        id
        approvedShareability {
          value
        }
      }
    }
  }
`);

const PostDoc = graphql(
  `
    query EngagementPostById($id: ID!) {
      post(id: $id) {
        ...engagementPostFields
      }
    }
  `,
  [postFields],
);

const LanguageEngagementPostsDoc = graphql(
  `
    query LanguageEngagementPosts($id: ID!) {
      languageEngagement(id: $id) {
        posts {
          canRead
          canCreate
          total
          items {
            ...engagementPostFields
          }
        }
      }
    }
  `,
  [postFields],
);

const InternshipEngagementPostsDoc = graphql(
  `
    query InternshipEngagementPosts($id: ID!) {
      internshipEngagement(id: $id) {
        posts {
          canRead
          canCreate
          total
          items {
            ...engagementPostFields
          }
        }
      }
    }
  `,
  [postFields],
);

const LanguageEngagementReportsDoc = graphql(`
  query LanguageEngagementReportsForPosts($id: ID!) {
    languageEngagement(id: $id) {
      progressReports {
        items {
          id
          start
          end
        }
      }
    }
  }
`);

const UpdateInternshipEngagementDatesDoc = graphql(`
  mutation UpdateInternshipEngagementDatesForPosts(
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

const InternshipEngagementReportsDoc = graphql(`
  query InternshipEngagementReportsForPosts($id: ID!) {
    internshipEngagement(id: $id) {
      gtlReports {
        items {
          id
          start
          end
        }
      }
    }
  }
`);
