import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, Role } from '~/common';
import { graphql } from '~/graphql';
import { PartnerType } from '../src/components/partner/dto';
import { ProjectType } from '../src/components/project/dto';
import {
  createInternshipEngagement,
  createLanguage,
  createLanguageEngagement,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  getUserFromSession,
  registerUser,
  runAsAdmin,
  type TestApp,
  updateProject,
} from './utility';

/**
 * Each resource below resolves `parent` in its own resolver from a typed link
 * (`project`, `budget`, `engagement`). A missing resolver falls through to the
 * shared ChangesetAware one, which returns null and fails `toEqual`; a wrong
 * link fails the `id` check.
 */
describe('Resource parent e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [
        Role.ProjectManager,
        Role.FieldOperationsDirector,
        Role.Controller,
      ],
    });
  });

  it('resolves the parents under a translation project', async () => {
    const project = await createProject(app, {
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });
    // Report sync runs on update, not create.
    await updateProject(app, {
      id: project.id,
      mouEnd: CalendarDate.fromISO('2020-12-30').toISO(),
      financialReportPeriod: 'Monthly',
    });
    await createPartnership(app, {
      project: project.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      mouStartOverride: null,
      mouEndOverride: null,
    });
    const language = await runAsAdmin(app, createLanguage);
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
      startDateOverride: CalendarDate.fromISO('2020-01-01').toISO(),
      endDateOverride: CalendarDate.fromISO('2020-06-30').toISO(),
    });

    const result = await app.graphql.query(TranslationParentsDoc, {
      project: project.id,
      engagement: engagement.id,
    });
    const projectParent = {
      id: project.id,
      __typename: 'MomentumTranslationProject',
    };

    expect(result.engagement.parent).toEqual(projectParent);

    const budget = result.project.budget.value!;
    expect(budget.parent).toEqual(projectParent);
    expect(budget.records.length).toBeGreaterThan(0);
    for (const record of budget.records) {
      expect(record.parent).toEqual({ id: budget.id, __typename: 'Budget' });
    }

    const { financialReports, narrativeReports } = result.project;
    expect(financialReports.items.length).toBeGreaterThan(0);
    expect(narrativeReports.items.length).toBeGreaterThan(0);
    for (const report of [
      ...financialReports.items,
      ...narrativeReports.items,
    ]) {
      expect(report.parent).toEqual(projectParent);
    }

    const { progressReports } = result.engagement;
    expect(progressReports.items.length).toBeGreaterThan(0);
    for (const report of progressReports.items) {
      expect(report.parent).toEqual({
        id: engagement.id,
        __typename: 'LanguageEngagement',
      });
    }
  });

  it('resolves an internship engagement parent', async () => {
    const project = await createProject(app, {
      type: ProjectType.Internship,
    });
    const intern = await getUserFromSession(app);
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      intern: intern.id,
    });

    const result = await app.graphql.query(InternshipParentDoc, {
      id: engagement.id,
    });
    expect(result.engagement.parent).toEqual({
      id: project.id,
      __typename: 'InternshipProject',
    });
  });
});

const TranslationParentsDoc = graphql(`
  query TranslationParents($project: ID!, $engagement: ID!) {
    project(id: $project) {
      budget {
        value {
          id
          parent {
            id
            __typename
          }
          records {
            parent {
              id
              __typename
            }
          }
        }
      }
      financialReports {
        items {
          parent {
            id
            __typename
          }
        }
      }
      narrativeReports {
        items {
          parent {
            id
            __typename
          }
        }
      }
    }
    engagement: languageEngagement(id: $engagement) {
      parent {
        id
        __typename
      }
      progressReports {
        items {
          parent {
            id
            __typename
          }
        }
      }
    }
  }
`);

const InternshipParentDoc = graphql(`
  query InternshipParent($id: ID!) {
    engagement: internshipEngagement(id: $id) {
      parent {
        id
        __typename
      }
    }
  }
`);
