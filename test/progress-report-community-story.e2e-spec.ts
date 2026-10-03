import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { type ID, Role } from '~/common';
import { LiveQueryStore } from '~/core/live-query';
import { graphql, type ResultOf } from '~/graphql';
import {
  createLanguage,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
  type TestUser,
} from './utility';

type Story = ResultOf<typeof storyFields>;

/**
 * The keys that actually reach the live-query store, resolved the same way
 * `LiveQueryStore.invalidateAll` does, so assertions pin the emitted key rather
 * than merely "something fired".
 */
const keysOf = (spy: jest.SpiedFunction<LiveQueryStore['invalidateAll']>) =>
  spy.mock.calls.flatMap(([identifiers]) =>
    [...identifiers].map((identifier) =>
      typeof identifier === 'string'
        ? identifier
        : `${
            typeof identifier[0] === 'string'
              ? identifier[0]
              : (identifier[0] as { name: string }).name
          }:${identifier[1]}`,
    ),
  );

// One featured community story per progress report (#3972). Choosing a story
// displaces the previous one in the same mutation; the response carries both
// so a client updates both. Project managers choose for their own projects,
// Marketing for any; the author (field partner) does not choose.
describe('Progress Report featured community story e2e', () => {
  let app: TestApp;
  /** Creates the project, so a member of it. */
  let projectManager: TestUser;
  /** Added to the project. */
  let memberFieldPartner: TestUser;
  /** Never on the project. */
  let outsiderProjectManager: TestUser;
  /** Never on the project; Marketing acts globally. */
  let marketing: TestUser;
  let admin: TestUser;
  let projectId: ID;
  /** A fresh report for every test, so featured state never carries over. */
  let reportId: ID;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    admin = await registerUser(app, { roles: [Role.Administrator] });

    await projectManager.login();
    // An MOU window already in the past, so the engagement's progress reports
    // exist for quarters that have closed (see CLAUDE.md).
    const project = await createProject(app, {
      mouStart: '2023-01-01',
      mouEnd: '2024-01-01',
    });
    projectId = project.id;
    await createProjectMember(app, {
      project: project.id,
      user: memberFieldPartner.id,
      roles: [Role.FieldPartner],
    });
  });

  beforeEach(async () => {
    await projectManager.login();
    const language = await runAsAdmin(app, createLanguage);
    const { createEng } = await app.graphql.mutate(CreateEngagementDoc, {
      input: { project: projectId, language: language.id },
    });
    const report = createEng.engagement.progressReports.items[0];
    if (!report) throw new Error('expected the engagement to have a report');
    reportId = report.id;
  });

  // `mockRestore()` clears `mock.calls`, so restore here and never in a
  // `finally` ahead of the assertions.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const stories = async () => {
    const { report } = await app.graphql.query(StoriesDoc, { id: reportId });
    if (report.__typename !== 'ProgressReport') {
      throw new Error('expected a progress report');
    }
    return report.communityStories;
  };
  const featuredIds = async () =>
    (await stories()).items
      .filter((story) => story.featured.value)
      .map((story) => story.id);

  /** Opened by the project manager with the nth community-story prompt. */
  const openStory = async (promptIndex: number): Promise<Story> => {
    await projectManager.login();
    const { available } = await stories();
    const prompt = available.prompts[promptIndex];
    if (!prompt)
      throw new Error(`expected community story prompt ${promptIndex}`);
    const { story } = await app.graphql.mutate(CreateStoryDoc, {
      input: { resource: reportId, prompt: prompt.id },
    });
    return story;
  };

  const feature = (id: ID) => app.graphql.mutate(FeatureStoryDoc, { id });
  const unfeature = (id: ID) => app.graphql.mutate(UnfeatureStoryDoc, { id });
  const cannotChoose = errors.unauthorized({
    message: 'You do not have permission to choose the featured story',
  });

  it('the project manager features a story, and choosing another displaces it', async () => {
    const storyA = await openStory(0);
    const storyB = await openStory(1);
    expect(storyA.featured.value).toBe(false);
    expect(storyA.featured.canEdit).toBe(true);
    expect(await featuredIds()).toEqual([]);

    const { changed: first } = await feature(storyA.id);
    expect(first.map((story) => story.id)).toEqual([storyA.id]);
    expect(first[0]!.featured.value).toBe(true);
    expect(await featuredIds()).toEqual([storyA.id]);

    // Both stories come back: the new holder first, then the displaced one.
    const { changed: second } = await feature(storyB.id);
    expect(second.map((story) => story.id)).toEqual([storyB.id, storyA.id]);
    expect(second[0]!.featured.value).toBe(true);
    expect(second[1]!.featured.value).toBe(false);
    expect(await featuredIds()).toEqual([storyB.id]);

    // Featuring the current holder again changes nothing else.
    const { changed: again } = await feature(storyB.id);
    expect(again.map((story) => story.id)).toEqual([storyB.id]);
    expect(await featuredIds()).toEqual([storyB.id]);
  });

  it('un-featuring leaves the report with no featured story', async () => {
    const story = await openStory(0);
    await feature(story.id);
    expect(await featuredIds()).toEqual([story.id]);

    const { story: cleared } = await unfeature(story.id);
    expect(cleared.id).toBe(story.id);
    expect(cleared.featured.value).toBe(false);
    expect(await featuredIds()).toEqual([]);
  });

  it('announces both changed stories to live queries under the PromptVariantResponse key', async () => {
    const storyA = await openStory(0);
    const storyB = await openStory(1);
    await feature(storyA.id);

    // `invalidate` delegates to `invalidateAll`, so this one spy catches both.
    const spy = jest.spyOn(app.get(LiveQueryStore), 'invalidateAll');
    await feature(storyB.id);

    const keys = keysOf(spy);
    expect(keys).toContain(`PromptVariantResponse:${storyA.id}`);
    expect(keys).toContain(`PromptVariantResponse:${storyB.id}`);
    // The subtype name is not how live queries index these rows.
    expect(
      keys.filter((key) => key.startsWith('ProgressReportCommunityStory:')),
    ).toEqual([]);
  });

  it('deleting a story announces it under the PromptVariantResponse key too', async () => {
    const story = await openStory(0);

    await admin.login();
    const spy = jest.spyOn(app.get(LiveQueryStore), 'invalidateAll');
    const { report } = await app.graphql.mutate(DeleteStoryDoc, {
      id: story.id,
    });
    expect(report.id).toBe(reportId);

    const keys = keysOf(spy);
    expect(keys).toContain(`PromptVariantResponse:${story.id}`);
    expect(
      keys.filter((key) => key.startsWith('ProgressReportCommunityStory:')),
    ).toEqual([]);
  });

  it('the field partner who wrote the story may not choose it', async () => {
    const story = await openStory(0);

    await memberFieldPartner.login();
    const { items } = await stories();
    const seen = items.find((item) => item.id === story.id);
    expect(seen?.featured.canRead).toBe(true);
    expect(seen?.featured.canEdit).toBe(false);

    await feature(story.id).expectError(cannotChoose);
    expect(await featuredIds()).toEqual([]);
  });

  it('a project manager who is not on the project may not choose', async () => {
    const story = await openStory(0);

    await outsiderProjectManager.login();
    await feature(story.id).expectError(cannotChoose);

    await projectManager.login();
    expect(await featuredIds()).toEqual([]);
  });

  it('marketing chooses from outside the project', async () => {
    const story = await openStory(0);

    await marketing.login();
    const { changed } = await feature(story.id);
    expect(changed.map((item) => item.id)).toEqual([story.id]);
    expect(changed[0]!.featured.value).toBe(true);
    expect(changed[0]!.featured.canEdit).toBe(true);
    expect(await featuredIds()).toEqual([story.id]);
  });

  it('a team news entry is not a community story, so it cannot be featured as one', async () => {
    await projectManager.login();
    const { teamNews } = await app.graphql.mutate(CreateTeamNewsDoc, {
      input: { resource: reportId, prompt: 'F4eY7VXhPpM' as ID },
    });

    await feature(teamNews.id).expectError(errors.notFound());
  });
});

const storyFields = graphql(`
  fragment featuredStory on PromptVariantResponse {
    id
    prompt {
      value {
        id
      }
    }
    featured {
      value
      canRead
      canEdit
    }
  }
`);

const StoriesDoc = graphql(
  `
    query ProgressReportCommunityStoriesFeatured($id: ID!) {
      report: periodicReport(id: $id) {
        __typename
        ... on ProgressReport {
          communityStories {
            items {
              ...featuredStory
            }
            available {
              prompts {
                id
              }
            }
          }
        }
      }
    }
  `,
  [storyFields],
);

const CreateStoryDoc = graphql(
  `
    mutation CreateCommunityStoryToFeature($input: ChoosePrompt!) {
      story: createProgressReportCommunityStory(input: $input) {
        ...featuredStory
      }
    }
  `,
  [storyFields],
);

const FeatureStoryDoc = graphql(
  `
    mutation FeatureCommunityStory($id: ID!) {
      changed: featureProgressReportCommunityStory(id: $id) {
        ...featuredStory
      }
    }
  `,
  [storyFields],
);

const UnfeatureStoryDoc = graphql(
  `
    mutation UnfeatureCommunityStory($id: ID!) {
      story: unfeatureProgressReportCommunityStory(id: $id) {
        ...featuredStory
      }
    }
  `,
  [storyFields],
);

const DeleteStoryDoc = graphql(`
  mutation DeleteCommunityStoryFeatured($id: ID!) {
    report: deleteProgressReportCommunityStory(id: $id) {
      id
    }
  }
`);

const CreateTeamNewsDoc = graphql(`
  mutation CreateTeamNewsNotAStory($input: ChoosePrompt!) {
    teamNews: createProgressReportTeamNews(input: $input) {
      id
    }
  }
`);

const CreateEngagementDoc = graphql(
  `
    mutation CreateLanguageEngagementForFeaturedStory(
      $input: CreateLanguageEngagement!
    ) {
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
);
