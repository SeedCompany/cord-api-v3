import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql, type ResultOf } from '~/graphql';
import { ProjectType } from '../src/components/project/dto';
import { type ErrorExpectations } from './setup/gql-client/gql-result';
import {
  createInternshipEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  registerUser,
  type TestApp,
  type TestUser,
} from './utility';

/** Minimal block-editor document the RichText (JSONObject) scalar accepts. */
const doc = (text: string) => ({
  version: '1',
  time: 1,
  blocks: [{ id: text, type: 'paragraph', data: { text } }],
});
interface RichDoc {
  blocks: Array<{ data: { text: string } }>;
}
const textOf = (value: unknown) => (value as RichDoc).blocks[0]!.data.text;

type ProseVariant = 'draft' | 'translated' | 'fpm' | 'published';
/** Variant keys travel as the ID scalar. */
const variant = (key: ProseVariant) => key as ID;

type ProseList = ResultOf<typeof proseListFields>;
type ProseResponse = ResultOf<typeof proseResponseFields>;
type Mutated<T> = PromiseLike<T> & {
  expectError: (expectations?: ErrorExpectations) => Promise<void>;
};

/**
 * Community Impact and Highlights are the same machinery with different
 * prompts and GraphQL names, so each is described here once and the matrix
 * below runs against both.
 */
interface Section {
  /** As the permission errors name the resource. */
  name: string;
  /** As the permission error names the report's edge. */
  edge: string;
  prompts: readonly [first: ID, second: ID];
  list: (report: ID) => Promise<ProseList>;
  create: (report: ID, prompt: ID) => Mutated<{ response: ProseResponse }>;
  changePrompt: (id: ID, prompt: ID) => Mutated<{ response: ProseResponse }>;
  update: (
    id: ID,
    variant: ID,
    response: object | null,
  ) => Mutated<{ response: ProseResponse }>;
  delete: (id: ID) => Mutated<{ report: { id: ID } }>;
}

// The two prompt-driven written sections of a GTL report (#3969), with the
// four audience variants Momentum uses: Global Leader (draft), Translation,
// Field Operations (fpm), Investor Communications (published). Who may read
// and write each variant copies the Progress Report's grants role for role.
describe('GTL Report prose sections e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added to every project created here. */
  let memberFieldPartner: TestUser;
  /** Added to every project created here. */
  let memberTranslator: TestUser;
  /** Never on a project; Marketing acts globally. */
  let marketing: TestUser;
  /** Never added to a project. */
  let outsiderFieldPartner: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    memberTranslator = await registerUser(app, { roles: [Role.Translator] });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    outsiderFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    admin = await registerUser(app, { roles: [Role.Administrator] });
    await projectManager.login();
  });

  // An Internship project whose MOU window is 2020, with one engagement whose
  // dates match it, so its GTL reports are Q1-Q4. Created by the project
  // manager, who thereby becomes a member; the member field partner and
  // translator are added.
  const createInternshipReport = async (): Promise<ID> => {
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
    await createProjectMember(app, {
      project: project.id,
      user: memberTranslator.id,
      roles: [Role.Translator],
    });
    const result = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement.id,
    });
    const q1 = result.engagement.gtlReports.items.find(
      (report) => report.start === '2020-01-01',
    );
    if (!q1) throw new Error('expected a Q1 2020 GTL report');
    return q1.id;
  };

  const gtlReportOf = <T>(result: {
    periodicReport: { __typename: string; section?: T };
  }): T => {
    const report = result.periodicReport;
    if (report.__typename !== 'GTLReport' || report.section === undefined) {
      throw new Error('expected a GTL report');
    }
    return report.section;
  };

  const communityImpact: Section = {
    name: 'gtl report community impact',
    edge: 'community impact',
    prompts: ['gtlCmtyImpct1' as ID, 'gtlCmtyImpct2' as ID],
    list: async (report) =>
      gtlReportOf(await app.graphql.query(CommunityImpactDoc, { id: report })),
    create: (report, prompt) =>
      app.graphql.mutate(CreateCommunityImpactDoc, {
        input: { resource: report, prompt },
      }),
    changePrompt: (id, prompt) =>
      app.graphql.mutate(ChangeCommunityImpactPromptDoc, {
        input: { id, prompt },
      }),
    update: (id, variant, response) =>
      app.graphql.mutate(UpdateCommunityImpactDoc, {
        input: { id, variant, response },
      }),
    delete: (id) => app.graphql.mutate(DeleteCommunityImpactDoc, { id }),
  };

  const highlights: Section = {
    name: 'gtl report highlight',
    edge: 'highlights',
    prompts: ['gtlHighlight1' as ID, 'gtlHighlight2' as ID],
    list: async (report) =>
      gtlReportOf(await app.graphql.query(HighlightsDoc, { id: report })),
    create: (report, prompt) =>
      app.graphql.mutate(CreateHighlightDoc, {
        input: { resource: report, prompt },
      }),
    changePrompt: (id, prompt) =>
      app.graphql.mutate(ChangeHighlightPromptDoc, { input: { id, prompt } }),
    update: (id, variant, response) =>
      app.graphql.mutate(UpdateHighlightDoc, {
        input: { id, variant, response },
      }),
    delete: (id) => app.graphql.mutate(DeleteHighlightDoc, { id }),
  };

  const variantKeys = (response: ProseResponse) =>
    response.responses.map((entry) => entry.variant.key);
  const responseFor = (response: ProseResponse, key: ProseVariant) =>
    response.responses.find((entry) => entry.variant.key === key)!;
  const cannotEdit = (label: string, section: Section) =>
    errors.unauthorized({
      message: `You do not have the permission to edit the "${label}" response for this ${section.name}`,
    });

  describe.each([
    ['Community Impact', communityImpact],
    ['Highlights', highlights],
  ])('%s', (_, section) => {
    let reportId: ID;
    /** Opened by the member field partner, as the leader would. */
    const open = async () => {
      await memberFieldPartner.login();
      const { response } = await section.create(reportId, section.prompts[0]);
      return response;
    };

    beforeAll(async () => {
      reportId = await createInternshipReport();
    });

    it('the global leader opens the section with a prompt and writes the draft', async () => {
      await memberFieldPartner.login();
      const before = await section.list(reportId);
      expect(before.canRead).toBe(true);
      expect(before.canCreate).toBe(true);
      expect(before.available.prompts.map((prompt) => prompt.id)).toEqual(
        expect.arrayContaining([...section.prompts]),
      );
      // Only the variant this role may write.
      expect(before.available.variants.map((option) => option.key)).toEqual([
        'draft',
      ]);

      const response = await open();
      expect(response.prompt.value?.id).toBe(section.prompts[0]);
      // A leader reads their own draft and the translation of it; the field
      // operations and investor versions are not theirs to see.
      expect(variantKeys(response)).toEqual(['draft', 'translated']);
      expect(responseFor(response, 'draft').response.canEdit).toBe(true);
      expect(responseFor(response, 'translated').response.canEdit).toBe(false);
      expect(response.canDelete).toBe(false);

      const { response: written } = await section.update(
        response.id,
        variant('draft'),
        doc('My draft'),
      );
      expect(textOf(responseFor(written, 'draft').response.value)).toBe(
        'My draft',
      );

      await section
        .update(response.id, variant('translated'), doc('Not mine to write'))
        .expectError(cannotEdit('Translation', section));

      // The section lists what was opened.
      const after = await section.list(reportId);
      expect(after.items.map((item) => item.id)).toContain(response.id);
    });

    it('swapping the prompt keeps the entry; only an editor of the entry may do it', async () => {
      const response = await open();

      // Not the author and no edit on the entry, so not theirs to re-prompt.
      await memberTranslator.login();
      await section
        .changePrompt(response.id, section.prompts[1])
        .expectError(errors.unauthorized());

      await admin.login();
      const { response: reprompted } = await section.changePrompt(
        response.id,
        section.prompts[1],
      );
      expect(reprompted.id).toBe(response.id);
      expect(reprompted.prompt.value?.id).toBe(section.prompts[1]);
    });

    it('the translator writes the translation and reads the draft, nothing more', async () => {
      const response = await open();

      await memberTranslator.login();
      const list = await section.list(reportId);
      expect(list.canRead).toBe(true);
      expect(list.canCreate).toBe(false);
      expect(list.available.variants.map((option) => option.key)).toEqual([
        'translated',
      ]);

      const { response: written } = await section.update(
        response.id,
        variant('translated'),
        doc('La traduction'),
      );
      expect(variantKeys(written)).toEqual(['draft', 'translated']);
      expect(textOf(responseFor(written, 'translated').response.value)).toBe(
        'La traduction',
      );

      await section
        .update(response.id, variant('draft'), doc('Rewriting the leader'))
        .expectError(cannotEdit('Global Leader', section));
    });

    it('the project manager writes the field operations version, not the investor one', async () => {
      const response = await open();

      await projectManager.login();
      const list = await section.list(reportId);
      expect(list.canCreate).toBe(true);
      // Matches Momentum: the manager may also fix up the draft and translation.
      expect(list.available.variants.map((option) => option.key)).toEqual([
        'draft',
        'translated',
        'fpm',
      ]);

      const { response: written } = await section.update(
        response.id,
        variant('fpm'),
        doc('Field operations take'),
      );
      // A member manager reads every variant.
      expect(variantKeys(written)).toEqual([
        'draft',
        'translated',
        'fpm',
        'published',
      ]);
      expect(textOf(responseFor(written, 'fpm').response.value)).toBe(
        'Field operations take',
      );
      expect(responseFor(written, 'published').response.canEdit).toBe(false);

      await section
        .update(response.id, variant('published'), doc('Not for investors yet'))
        .expectError(cannotEdit('Investor Communications', section));
    });

    it('marketing writes the investor version from outside the project', async () => {
      const response = await open();

      await marketing.login();
      const list = await section.list(reportId);
      expect(list.canRead).toBe(true);
      expect(list.canCreate).toBe(true);
      expect(list.available.variants.map((option) => option.key)).toEqual([
        'published',
      ]);

      const { response: written } = await section.update(
        response.id,
        variant('published'),
        doc('For our investors'),
      );
      expect(variantKeys(written)).toEqual([
        'draft',
        'translated',
        'fpm',
        'published',
      ]);
      expect(textOf(responseFor(written, 'published').response.value)).toBe(
        'For our investors',
      );

      await section
        .update(response.id, variant('fpm'), doc('Not field operations'))
        .expectError(cannotEdit('Field Operations', section));
    });

    it('a field partner who is not on the project sees nothing and may add nothing', async () => {
      await open();

      await outsiderFieldPartner.login();
      const list = await section.list(reportId);
      expect(list.canRead).toBe(false);
      expect(list.canCreate).toBe(false);
      expect(list.items).toEqual([]);
      expect(list.total).toBe(0);
      expect(list.available.variants).toEqual([]);

      await section.create(reportId, section.prompts[0]).expectError(
        errors.unauthorized({
          message: `You do not have the permission to create ${section.edge} for this gtl report`,
        }),
      );
    });

    it('only an administrator removes an entry', async () => {
      const response = await open();

      await projectManager.login();
      await section.delete(response.id).expectError(
        errors.unauthorized({
          message: `You do not have the permission to delete this ${section.name}`,
        }),
      );

      await admin.login();
      const { report } = await section.delete(response.id);
      expect(report.id).toBe(reportId);

      await memberFieldPartner.login();
      const list = await section.list(reportId);
      expect(list.items.map((item) => item.id)).not.toContain(response.id);
    });
  });
});

const proseResponseFields = graphql(`
  fragment gtlProseResponse on PromptVariantResponse {
    id
    prompt {
      value {
        id
      }
      canRead
      canEdit
    }
    responses {
      variant {
        key
        label
      }
      response {
        value
        canRead
        canEdit
      }
    }
    canDelete
  }
`);

const proseListFields = graphql(
  `
    fragment gtlProseList on PromptVariantResponseList {
      canRead
      canCreate
      total
      items {
        ...gtlProseResponse
      }
      available {
        prompts {
          id
        }
        variants {
          key
        }
      }
    }
  `,
  [proseResponseFields],
);

const CommunityImpactDoc = graphql(
  `
    query GtlReportCommunityImpact($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on GTLReport {
          section: communityImpact {
            ...gtlProseList
          }
        }
      }
    }
  `,
  [proseListFields],
);

const CreateCommunityImpactDoc = graphql(
  `
    mutation CreateGtlReportCommunityImpact($input: ChoosePrompt!) {
      response: createGtlReportCommunityImpact(input: $input) {
        ...gtlProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const ChangeCommunityImpactPromptDoc = graphql(
  `
    mutation ChangeGtlReportCommunityImpactPrompt($input: ChangePrompt!) {
      response: changeGtlReportCommunityImpactPrompt(input: $input) {
        ...gtlProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const UpdateCommunityImpactDoc = graphql(
  `
    mutation UpdateGtlReportCommunityImpactResponse(
      $input: UpdatePromptVariantResponse!
    ) {
      response: updateGtlReportCommunityImpactResponse(input: $input) {
        ...gtlProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const DeleteCommunityImpactDoc = graphql(`
  mutation DeleteGtlReportCommunityImpact($id: ID!) {
    report: deleteGtlReportCommunityImpact(id: $id) {
      id
    }
  }
`);

const HighlightsDoc = graphql(
  `
    query GtlReportHighlights($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on GTLReport {
          section: highlights {
            ...gtlProseList
          }
        }
      }
    }
  `,
  [proseListFields],
);

const CreateHighlightDoc = graphql(
  `
    mutation CreateGtlReportHighlight($input: ChoosePrompt!) {
      response: createGtlReportHighlight(input: $input) {
        ...gtlProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const ChangeHighlightPromptDoc = graphql(
  `
    mutation ChangeGtlReportHighlightPrompt($input: ChangePrompt!) {
      response: changeGtlReportHighlightPrompt(input: $input) {
        ...gtlProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const UpdateHighlightDoc = graphql(
  `
    mutation UpdateGtlReportHighlightResponse(
      $input: UpdatePromptVariantResponse!
    ) {
      response: updateGtlReportHighlightResponse(input: $input) {
        ...gtlProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const DeleteHighlightDoc = graphql(`
  mutation DeleteGtlReportHighlight($id: ID!) {
    report: deleteGtlReportHighlight(id: $id) {
      id
    }
  }
`);

const EngagementGtlReportsDoc = graphql(`
  query EngagementGtlReportsForProse($id: ID!) {
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
