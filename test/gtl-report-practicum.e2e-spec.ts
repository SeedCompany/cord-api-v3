import { beforeAll, describe, expect, it } from '@jest/globals';
import { generateId, type ID, Role } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { ProjectType } from '../src/components/project/dto';
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

// The Practicum section of a GTL report (#3969): the practicum and workshop
// involvement reported for a quarter, each with an optional mentor and the
// outcomes. Field Partner and Project Manager members manage it; Translator
// members, Regional Director, Field Ops Director and Marketing read it.
describe('GTL Report Practicum e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added to every project created here. */
  let memberFieldPartner: TestUser;
  /** Added to every project created here. */
  let memberTranslator: TestUser;
  /** Never added to a project. */
  let outsiderFieldPartner: TestUser;
  /** A Project Manager who is NOT on the project. */
  let outsiderProjectManager: TestUser;
  let marketing: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    memberTranslator = await registerUser(app, { roles: [Role.Translator] });
    outsiderFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    await projectManager.login();
  });

  // An Internship project whose MOU window is 2020, with one engagement whose
  // dates match it. Created by the project manager, who thereby becomes a
  // member; the member field partner and translator are added. Returns the
  // Q1 report.
  const createInternship = async () => {
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
    return { project, engagement, report: q1 };
  };

  const createPracticum = async (
    input: Partial<InputOf<typeof CreatePracticumDoc>> & { report: ID },
  ) => {
    const result = await app.graphql.mutate(CreatePracticumDoc, {
      input: { involvement: 'Oral Bible storying workshop', ...input },
    });
    return result.createGtlReportPracticum.gtlReportPracticum;
  };

  const practicumsOf = async (report: ID) => {
    const result = await app.graphql.query(ReportPracticumsDoc, {
      id: report,
    });
    const periodicReport = result.periodicReport;
    if (periodicReport.__typename !== 'GTLReport') {
      throw new Error('expected a GTL report');
    }
    return periodicReport.practicums;
  };

  it('a member field partner reports, revises and removes practicum involvement', async () => {
    const { report } = await createInternship();

    await memberFieldPartner.login();
    const created = await createPracticum({
      report: report.id,
      involvement: 'Oral Bible storying workshop',
      mentor: projectManager.id,
      outcomes: doc('Led two sessions'),
      order: 2,
    });
    expect(created.involvement.value).toBe('Oral Bible storying workshop');
    expect(created.involvement.canEdit).toBe(true);
    expect(created.mentor.value?.id).toBe(projectManager.id);
    expect(textOf(created.outcomes.value)).toBe('Led two sessions');
    expect(created.order.value).toBe(2);
    expect(created.canDelete).toBe(true);

    const updated = await app.graphql.mutate(UpdatePracticumDoc, {
      input: {
        id: created.id,
        involvement: 'Exegesis workshop',
        mentor: null,
        outcomes: null,
        order: 1,
      },
    });
    const revised = updated.updateGtlReportPracticum.gtlReportPracticum;
    expect(revised.id).toBe(created.id);
    expect(revised.involvement.value).toBe('Exegesis workshop');
    expect(revised.mentor.value).toBeNull();
    expect(revised.outcomes.value).toBeNull();
    expect(revised.order.value).toBe(1);

    const listed = await practicumsOf(report.id);
    expect(listed.map((practicum) => practicum.id)).toEqual([created.id]);
    expect(listed[0]!.involvement.value).toBe('Exegesis workshop');

    await app.graphql.mutate(DeletePracticumDoc, { id: created.id });
    expect(await practicumsOf(report.id)).toEqual([]);
  });

  it('lists in the given order, then by when it was reported', async () => {
    const { report } = await createInternship();
    const second = await createPracticum({
      report: report.id,
      involvement: 'B: second',
      order: 2,
    });
    const first = await createPracticum({
      report: report.id,
      involvement: 'A: first',
      order: 1,
    });
    const alsoSecond = await createPracticum({
      report: report.id,
      involvement: 'C: also second, reported later',
      order: 2,
    });
    expect(
      (await practicumsOf(report.id)).map((practicum) => practicum.id),
    ).toEqual([first.id, second.id, alsoSecond.id]);
  });

  it('the mentor has to be a real person', async () => {
    const { report } = await createInternship();
    const nobody = await generateId();

    await app.graphql
      .mutate(CreatePracticumDoc, {
        input: {
          report: report.id,
          involvement: 'Mentored by no one',
          mentor: nobody,
        },
      })
      .expectError(errors.input({ field: 'mentor' }));

    const created = await createPracticum({ report: report.id });
    await app.graphql
      .mutate(UpdatePracticumDoc, {
        input: { id: created.id, mentor: nobody },
      })
      .expectError(errors.input({ field: 'mentor' }));
  });

  it('refuses a report that is not a GTL report', async () => {
    await createInternship();
    await app.graphql
      .mutate(CreatePracticumDoc, {
        input: { report: await generateId(), involvement: 'Nowhere' },
      })
      .expectError(errors.notFound({ field: 'report' }));
  });

  describe('who may do what', () => {
    it('a field partner who is not on the project is refused', async () => {
      const { report } = await createInternship();
      const created = await createPracticum({ report: report.id });

      await outsiderFieldPartner.login();
      await app.graphql
        .mutate(CreatePracticumDoc, {
          input: { report: report.id, involvement: 'Sneak one in' },
        })
        .expectError(
          errors.unauthorized({
            message:
              'You do not have the permission to create gtl report practicums',
          }),
        );
      await app.graphql
        .mutate(UpdatePracticumDoc, {
          input: { id: created.id, involvement: 'Rewritten' },
        })
        .expectError(
          errors.unauthorized({
            message:
              'You do not have the permission to edit this gtl report practicum',
          }),
        );
    });

    // The read grant is member-conditioned and applied as SQL, so an outsider
    // gets an EMPTY section rather than redacted rows. Paired with a positive
    // control on the same user so the empty list can't pass vacuously.
    it('hides the section from a project manager who is not on the project', async () => {
      const { project, report } = await createInternship();
      await createPracticum({ report: report.id });

      await outsiderProjectManager.login();
      expect(await practicumsOf(report.id)).toEqual([]);

      await projectManager.login();
      await createProjectMember(app, {
        project: project.id,
        user: outsiderProjectManager.id,
        roles: [Role.ProjectManager],
      });

      await outsiderProjectManager.login();
      const listed = await practicumsOf(report.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]!.involvement.canEdit).toBe(true);
      expect(listed[0]!.canDelete).toBe(true);
    });

    it('translators and marketing read it but cannot change it', async () => {
      const { report } = await createInternship();
      const created = await createPracticum({
        report: report.id,
        mentor: projectManager.id,
      });

      for (const reader of [memberTranslator, marketing]) {
        await reader.login();
        const [listed] = await practicumsOf(report.id);
        expect(listed!.id).toBe(created.id);
        expect(listed!.involvement.canRead).toBe(true);
        expect(listed!.involvement.canEdit).toBe(false);
        expect(listed!.mentor.value?.id).toBe(projectManager.id);
        expect(listed!.canDelete).toBe(false);

        await app.graphql
          .mutate(UpdatePracticumDoc, {
            input: { id: created.id, involvement: 'Rewritten' },
          })
          .expectError(
            errors.unauthorized({
              message:
                'You do not have the permission to edit this gtl report practicum',
            }),
          );
        await app.graphql
          .mutate(DeletePracticumDoc, { id: created.id })
          .expectError(
            errors.unauthorized({
              message:
                'You do not have the permission to delete this gtl report practicum',
            }),
          );
      }
    });
  });
});

const practicumFields = graphql(`
  fragment gtlReportPracticumFields on GtlReportPracticum {
    id
    involvement {
      value
      canRead
      canEdit
    }
    mentor {
      value {
        id
      }
      canRead
      canEdit
    }
    outcomes {
      value
      canRead
      canEdit
    }
    order {
      value
    }
    canDelete
  }
`);

const CreatePracticumDoc = graphql(
  `
    mutation CreateGtlReportPracticum($input: CreateGtlReportPracticum!) {
      createGtlReportPracticum(input: $input) {
        gtlReportPracticum {
          ...gtlReportPracticumFields
        }
      }
    }
  `,
  [practicumFields],
);

const UpdatePracticumDoc = graphql(
  `
    mutation UpdateGtlReportPracticum($input: UpdateGtlReportPracticum!) {
      updateGtlReportPracticum(input: $input) {
        gtlReportPracticum {
          ...gtlReportPracticumFields
        }
      }
    }
  `,
  [practicumFields],
);

const DeletePracticumDoc = graphql(`
  mutation DeleteGtlReportPracticum($id: ID!) {
    deleteGtlReportPracticum(id: $id) {
      __typename
    }
  }
`);

const ReportPracticumsDoc = graphql(
  `
    query ReportPracticums($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on GTLReport {
          practicums {
            ...gtlReportPracticumFields
          }
        }
      }
    }
  `,
  [practicumFields],
);

const EngagementGtlReportsDoc = graphql(`
  query EngagementGtlReportsForPracticums($id: ID!) {
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
