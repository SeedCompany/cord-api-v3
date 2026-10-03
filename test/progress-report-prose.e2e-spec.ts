import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql, type ResultOf } from '~/graphql';
import { type ErrorExpectations } from './setup/gql-client/gql-result';
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
 * Other Activities and Next Quarter Plans are the same machinery with
 * different prompts and GraphQL names, so each is described here once and the
 * matrix below runs against both.
 */
interface Section {
  /** As the permission errors name the resource. */
  name: string;
  /** As the permission error names the report's edge. */
  edge: string;
  /** The one prompt each section offers. */
  prompt: ID;
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

// The two new prompt-driven written sections of a Progress Report (#3971),
// with the four audience variants the report already uses for Team News and
// Community Stories: Partner (draft), Translation, Field Operations (fpm),
// Investor Communications (published). Who may read and write each variant is
// granted role for role alongside Team News in the same policies.
describe('Progress Report prose sections e2e', () => {
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

  // A language project whose MOU window has already closed, with one
  // engagement inheriting those dates, so its progress reports exist for
  // quarters that are over. Created by the project manager, who thereby
  // becomes a member; the member field partner and translator are added.
  const createLanguageReport = async (): Promise<ID> => {
    await projectManager.login();
    const project = await createProject(app, {
      mouStart: '2023-01-01',
      mouEnd: '2024-01-01',
    });
    const language = await runAsAdmin(app, createLanguage);
    const { createEng } = await app.graphql.mutate(CreateEngagementDoc, {
      input: { project: project.id, language: language.id },
    });
    const report = createEng.engagement.progressReports.items[0];
    if (!report) throw new Error('expected the engagement to have a report');
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
    return report.id;
  };

  const progressReportOf = <T>(result: {
    periodicReport: { __typename: string; section?: T };
  }): T => {
    const report = result.periodicReport;
    if (
      report.__typename !== 'ProgressReport' ||
      report.section === undefined
    ) {
      throw new Error('expected a progress report');
    }
    return report.section;
  };

  const otherActivities: Section = {
    name: 'progress report other activities',
    edge: 'other activities',
    prompt: 'pRTuUgV2mHq' as ID,
    list: async (report) =>
      progressReportOf(
        await app.graphql.query(OtherActivitiesDoc, { id: report }),
      ),
    create: (report, prompt) =>
      app.graphql.mutate(CreateOtherActivitiesDoc, {
        input: { resource: report, prompt },
      }),
    changePrompt: (id, prompt) =>
      app.graphql.mutate(ChangeOtherActivitiesPromptDoc, {
        input: { id, prompt },
      }),
    update: (id, variant, response) =>
      app.graphql.mutate(UpdateOtherActivitiesDoc, {
        input: { id, variant, response },
      }),
    delete: (id) => app.graphql.mutate(DeleteOtherActivitiesDoc, { id }),
  };

  const nextQuarterPlans: Section = {
    name: 'progress report next quarter plans',
    edge: 'next quarter plans',
    prompt: 'nQpLa5sKdW3' as ID,
    list: async (report) =>
      progressReportOf(
        await app.graphql.query(NextQuarterPlansDoc, { id: report }),
      ),
    create: (report, prompt) =>
      app.graphql.mutate(CreateNextQuarterPlansDoc, {
        input: { resource: report, prompt },
      }),
    changePrompt: (id, prompt) =>
      app.graphql.mutate(ChangeNextQuarterPlansPromptDoc, {
        input: { id, prompt },
      }),
    update: (id, variant, response) =>
      app.graphql.mutate(UpdateNextQuarterPlansDoc, {
        input: { id, variant, response },
      }),
    delete: (id) => app.graphql.mutate(DeleteNextQuarterPlansDoc, { id }),
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
    ['Other Activities', otherActivities],
    ['Next Quarter Plans', nextQuarterPlans],
  ])('%s', (_, section) => {
    let reportId: ID;
    /** Opened by the member field partner, as the partner would. */
    const open = async () => {
      await memberFieldPartner.login();
      const { response } = await section.create(reportId, section.prompt);
      return response;
    };

    beforeAll(async () => {
      reportId = await createLanguageReport();
    });

    it('the field partner opens the section with its prompt and writes the draft', async () => {
      await memberFieldPartner.login();
      const before = await section.list(reportId);
      expect(before.canRead).toBe(true);
      expect(before.canCreate).toBe(true);
      // Exactly the one persisted prompt.
      expect(before.available.prompts.map((prompt) => prompt.id)).toEqual([
        section.prompt,
      ]);
      // Only the variant this role may write.
      expect(before.available.variants.map((option) => option.key)).toEqual([
        'draft',
      ]);

      const response = await open();
      expect(response.prompt.value?.id).toBe(section.prompt);
      // A partner reads their own draft and the translation of it; the field
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

    // There is a single prompt, so re-choosing it changes nothing; what this
    // pins is who may re-prompt an entry at all.
    it('re-choosing the prompt keeps the entry; only an editor of the entry may do it', async () => {
      const response = await open();

      // Not the author and no edit on the entry, so not theirs to re-prompt.
      await memberTranslator.login();
      await section
        .changePrompt(response.id, section.prompt)
        .expectError(errors.unauthorized());

      await admin.login();
      const { response: reprompted } = await section.changePrompt(
        response.id,
        section.prompt,
      );
      expect(reprompted.id).toBe(response.id);
      expect(reprompted.prompt.value?.id).toBe(section.prompt);
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
        .update(response.id, variant('draft'), doc('Rewriting the partner'))
        .expectError(cannotEdit('Partner', section));
    });

    it('the project manager writes the field operations version, not the investor one', async () => {
      const response = await open();

      await projectManager.login();
      const list = await section.list(reportId);
      expect(list.canCreate).toBe(true);
      // The manager may also fix up the draft and translation.
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

      await section.create(reportId, section.prompt).expectError(
        errors.unauthorized({
          message: `You do not have the permission to create ${section.edge} for this progress report`,
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
  fragment progressReportProseResponse on PromptVariantResponse {
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
    fragment progressReportProseList on PromptVariantResponseList {
      canRead
      canCreate
      total
      items {
        ...progressReportProseResponse
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

const OtherActivitiesDoc = graphql(
  `
    query ProgressReportOtherActivities($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on ProgressReport {
          section: otherActivities {
            ...progressReportProseList
          }
        }
      }
    }
  `,
  [proseListFields],
);

const CreateOtherActivitiesDoc = graphql(
  `
    mutation CreateProgressReportOtherActivities($input: ChoosePrompt!) {
      response: createProgressReportOtherActivities(input: $input) {
        ...progressReportProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const ChangeOtherActivitiesPromptDoc = graphql(
  `
    mutation ChangeProgressReportOtherActivitiesPrompt($input: ChangePrompt!) {
      response: changeProgressReportOtherActivitiesPrompt(input: $input) {
        ...progressReportProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const UpdateOtherActivitiesDoc = graphql(
  `
    mutation UpdateProgressReportOtherActivitiesResponse(
      $input: UpdatePromptVariantResponse!
    ) {
      response: updateProgressReportOtherActivitiesResponse(input: $input) {
        ...progressReportProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const DeleteOtherActivitiesDoc = graphql(`
  mutation DeleteProgressReportOtherActivities($id: ID!) {
    report: deleteProgressReportOtherActivities(id: $id) {
      id
    }
  }
`);

const NextQuarterPlansDoc = graphql(
  `
    query ProgressReportNextQuarterPlans($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on ProgressReport {
          section: nextQuarterPlans {
            ...progressReportProseList
          }
        }
      }
    }
  `,
  [proseListFields],
);

const CreateNextQuarterPlansDoc = graphql(
  `
    mutation CreateProgressReportNextQuarterPlans($input: ChoosePrompt!) {
      response: createProgressReportNextQuarterPlans(input: $input) {
        ...progressReportProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const ChangeNextQuarterPlansPromptDoc = graphql(
  `
    mutation ChangeProgressReportNextQuarterPlansPrompt($input: ChangePrompt!) {
      response: changeProgressReportNextQuarterPlansPrompt(input: $input) {
        ...progressReportProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const UpdateNextQuarterPlansDoc = graphql(
  `
    mutation UpdateProgressReportNextQuarterPlansResponse(
      $input: UpdatePromptVariantResponse!
    ) {
      response: updateProgressReportNextQuarterPlansResponse(input: $input) {
        ...progressReportProseResponse
      }
    }
  `,
  [proseResponseFields],
);

const DeleteNextQuarterPlansDoc = graphql(`
  mutation DeleteProgressReportNextQuarterPlans($id: ID!) {
    report: deleteProgressReportNextQuarterPlans(id: $id) {
      id
    }
  }
`);

const CreateEngagementDoc = graphql(
  `
    mutation CreateLanguageEngagementForProse(
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
