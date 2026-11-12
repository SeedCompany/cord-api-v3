import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { type ID, Role } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { projects } from '~/core/drizzle/schema';
import { graphql } from '~/graphql';
import { type ProjectType } from '../../src/components/project/dto';
import { createProject } from '../operations/project';
import {
  createApp,
  createTesterWithRole,
  type IdentifiedTester,
  type TestApp,
  type Tester,
} from '../setup';
import { createFundingAccount, createLocation, errors } from '../utility';

/**
 * "Initial Fiscal Year Allocation" on projects (cord-field#1902).
 *
 * - A four-digit fiscal year, blank until someone records it.
 * - On every project type except Multiplication.
 * - Editable by Regional Directors (on their projects) and Field Operations
 *   Directors while the project is In Development; after that, Admins only.
 */

let admin: IdentifiedTester;
let regionalDirector: IdentifiedTester;
let fieldOpsDirector: IdentifiedTester;
let projectManager: IdentifiedTester;
let fieldServices: IdentifiedTester;
let primaryLocation: ID<'Location'>;
let app: TestApp;

beforeAll(async () => {
  app = await createApp();
  [admin, regionalDirector, fieldOpsDirector, projectManager, fieldServices] =
    await Promise.all([
      createTesterWithRole(app, Role.Administrator),
      createTesterWithRole(app, Role.RegionalDirector),
      createTesterWithRole(app, Role.FieldOperationsDirector),
      createTesterWithRole(app, Role.ProjectManager),
      createTesterWithRole(app, Role.FieldServices),
    ]);

  // Leaving In Development requires a primary location (RequiredWhen), and
  // a location can only be one with a funding account.
  const fundingAccount = await createFundingAccount(admin.legacyApp);
  const location = await createLocation(admin.legacyApp, {
    fundingAccount: fundingAccount.id,
  });
  primaryLocation = location.id;
});

const newProject = async (type: ProjectType = 'MomentumTranslation') =>
  await admin.apply(createProject({ type, primaryLocation }));

const addMember = async (
  project: ID,
  member: IdentifiedTester,
  roles: Role[],
) => {
  await admin.run(CreateProjectMemberDoc, {
    input: { project, user: member.identity.id, roles },
  });
};

const setYear = async (
  tester: Tester,
  id: ID,
  initialFiscalYearAllocation: number | null,
) => {
  const result = await tester.run(UpdateYearDoc, {
    input: { id, initialFiscalYearAllocation },
  });
  return result.updateProject.project.initialFiscalYearAllocation;
};

const readYear = async (tester: Tester, id: ID) => {
  const result = await tester.run(ReadYearDoc, { id });
  return result.project.initialFiscalYearAllocation;
};

const makeActive = async (project: ID) => {
  const result = await admin.run(TransitionProjectDoc, {
    input: { project, bypassTo: 'Active' },
  });
  expect(result.transitionProject.project.status).toBe('Active');
};

const unauthorizedFor = (typename: string) =>
  errors.unauthorized({
    message: `You do not have permission to update ${typename}.initialFiscalYearAllocation`,
  });

describe('storage', () => {
  it.each(['MomentumTranslation', 'Internship'] as const)(
    'is blank on a new %s project',
    async (type) => {
      const project = await newProject(type);
      expect(project.initialFiscalYearAllocation.value).toBeNull();
      expect(project.initialFiscalYearAllocation.canRead).toBe(true);
    },
  );

  it.each(['MomentumTranslation', 'Internship'] as const)(
    'is set, read back and cleared on a %s project',
    async (type) => {
      const project = await newProject(type);

      expect((await setYear(admin, project.id, 2027)).value).toBe(2027);
      expect((await readYear(admin, project.id)).value).toBe(2027);

      expect((await setYear(admin, project.id, null)).value).toBeNull();
      expect((await readYear(admin, project.id)).value).toBeNull();
    },
  );

  it('leaves the value alone when an update does not mention it', async () => {
    const project = await newProject();
    await setYear(admin, project.id, 2027);

    await admin.run(UpdateEstimatedSubmissionDoc, {
      input: { id: project.id, estimatedSubmission: '2026-12-01' },
    });

    expect((await readYear(admin, project.id)).value).toBe(2027);
  });

  it('is readable by roles that cannot edit it', async () => {
    const project = await newProject();
    await setYear(admin, project.id, 2028);

    const seen = await readYear(projectManager, project.id);
    expect(seen).toEqual({ value: 2028, canRead: true, canEdit: false });
  });
});

describe('Multiplication projects', () => {
  it('refuses a year', async () => {
    const project = await newProject('MultiplicationTranslation');

    await expect(setYear(admin, project.id, 2027)).rejects.toThrowGqlError(
      errors.input({
        message:
          'Initial fiscal year allocation is not applicable to MultiplicationTranslation projects',
        field: 'initialFiscalYearAllocation',
      }),
    );
    expect((await readYear(admin, project.id)).value).toBeNull();
  });

  it('accepts a null, which changes nothing', async () => {
    // A shared project form may send every field; a blank is harmless.
    const project = await newProject('MultiplicationTranslation');
    expect((await setYear(admin, project.id, null)).value).toBeNull();
  });
});

describe('validation', () => {
  it.each([1000, 2027, 9999])(
    'accepts the four-digit year %s',
    async (year) => {
      const project = await newProject();
      expect((await setYear(admin, project.id, year)).value).toBe(year);
    },
  );

  it.each([27, 999, 10000, -2027])(
    'rejects %s, which is not four digits',
    async (year) => {
      const project = await newProject();
      await expect(setYear(admin, project.id, year)).rejects.toThrowGqlError(
        errors.validation({
          initialFiscalYearAllocation: {
            [year < 1000 ? 'min' : 'max']: 'Must be a four-digit fiscal year',
          },
        }),
      );
      expect((await readYear(admin, project.id)).value).toBeNull();
    },
  );

  it('is refused by the database too, for writes that skip the API', async () => {
    // The check constraint is the backstop for scripts and other direct
    // writes, which never pass through the API's validation.
    const project = await newProject();
    const db = app.get(DrizzleService).client;

    const failure = await db
      .update(projects)
      .set({ initialFiscalYearAllocation: 27 })
      .where(eq(projects.id, project.id))
      .then(
        () => undefined,
        (e: unknown) => e,
      );

    expect(failure).toMatchObject({
      cause: {
        code: '23514', // check_violation
        constraint: 'projects_initial_fiscal_year_allocation_four_digits_chk',
      },
    });
  });

  it('rejects a non-integer at the schema', async () => {
    const project = await newProject();
    await expect(setYear(admin, project.id, 2027.5)).rejects.toThrowGqlError(
      errors.schema(),
    );
  });
});

describe('while In Development', () => {
  it('a Field Operations Director can edit it on any project', async () => {
    const project = await newProject();
    expect(project.status).toBe('InDevelopment');

    expect(await readYear(fieldOpsDirector, project.id)).toMatchObject({
      canEdit: true,
    });
    expect((await setYear(fieldOpsDirector, project.id, 2027)).value).toBe(
      2027,
    );
  });

  it('a Regional Director can edit it on their own project', async () => {
    const project = await newProject();
    await addMember(project.id, regionalDirector, [Role.RegionalDirector]);

    expect(await readYear(regionalDirector, project.id)).toMatchObject({
      canEdit: true,
    });
    expect((await setYear(regionalDirector, project.id, 2027)).value).toBe(
      2027,
    );
  });

  it('a Regional Director cannot edit it on a project they are not on', async () => {
    const project = await newProject();

    expect(await readYear(regionalDirector, project.id)).toMatchObject({
      canEdit: false,
    });
    await expect(
      setYear(regionalDirector, project.id, 2027),
    ).rejects.toThrowGqlError(unauthorizedFor('MomentumTranslationProject'));
  });

  it('a Project Manager on the project cannot edit it, but can still edit the rest', async () => {
    const project = await newProject();
    await addMember(project.id, projectManager, [Role.ProjectManager]);

    expect(await readYear(projectManager, project.id)).toMatchObject({
      canRead: true,
      canEdit: false,
    });
    await expect(
      setYear(projectManager, project.id, 2027),
    ).rejects.toThrowGqlError(unauthorizedFor('MomentumTranslationProject'));

    // The override is scoped to this field. Their general edit is intact.
    const { updateProject } = await projectManager.run(
      UpdateEstimatedSubmissionDoc,
      { input: { id: project.id, estimatedSubmission: '2026-12-01' } },
    );
    expect(updateProject.project.estimatedSubmission.value).toBe('2026-12-01');
  });

  it('Field Services cannot edit it', async () => {
    const project = await newProject();

    expect(await readYear(fieldServices, project.id)).toMatchObject({
      canEdit: false,
    });
    await expect(
      setYear(fieldServices, project.id, 2027),
    ).rejects.toThrowGqlError(unauthorizedFor('MomentumTranslationProject'));
  });

  it('applies to Internship projects too', async () => {
    const project = await newProject('Internship');
    expect((await setYear(fieldOpsDirector, project.id, 2027)).value).toBe(
      2027,
    );
  });
});

describe('once no longer In Development', () => {
  it('a Field Operations Director can no longer edit it', async () => {
    const project = await newProject();
    await makeActive(project.id);

    expect(await readYear(fieldOpsDirector, project.id)).toMatchObject({
      canRead: true,
      canEdit: false,
    });
    await expect(
      setYear(fieldOpsDirector, project.id, 2027),
    ).rejects.toThrowGqlError(unauthorizedFor('MomentumTranslationProject'));
  });

  it('a Regional Director on the project can no longer edit it', async () => {
    const project = await newProject();
    await addMember(project.id, regionalDirector, [Role.RegionalDirector]);
    await makeActive(project.id);

    await expect(
      setYear(regionalDirector, project.id, 2027),
    ).rejects.toThrowGqlError(unauthorizedFor('MomentumTranslationProject'));
  });

  it('an Admin still can, and the value set in development survives', async () => {
    const project = await newProject();
    await setYear(fieldOpsDirector, project.id, 2027);
    await makeActive(project.id);

    expect((await readYear(fieldOpsDirector, project.id)).value).toBe(2027);
    expect((await setYear(admin, project.id, 2028)).value).toBe(2028);
  });
});

describe('list sort', () => {
  it('sorts by year, blanks last either way', async () => {
    const tag = faker.string.alpha(12);
    const named = async (year: number | null) => {
      const project = await admin.apply(
        createProject({ name: `${tag} ${faker.string.uuid()}` }),
      );
      if (year != null) await setYear(admin, project.id, year);
      return project.id;
    };
    const fy2030 = await named(2030);
    const blank = await named(null);
    const fy2027 = await named(2027);

    const list = async (order: 'ASC' | 'DESC') => {
      const { projects } = await admin.run(ListSortedDoc, {
        input: {
          sort: 'initialFiscalYearAllocation',
          order,
          count: 10,
          filter: { name: tag },
        },
      });
      return projects.items.map((p) => p.id);
    };

    expect(await list('ASC')).toEqual([fy2027, fy2030, blank]);
    expect(await list('DESC')).toEqual([fy2030, fy2027, blank]);
  });
});

const UpdateYearDoc = graphql(`
  mutation UpdateInitialFiscalYearAllocation($input: UpdateProject!) {
    updateProject(input: $input) {
      project {
        id
        initialFiscalYearAllocation {
          value
          canRead
          canEdit
        }
      }
    }
  }
`);

const ReadYearDoc = graphql(`
  query ReadInitialFiscalYearAllocation($id: ID!) {
    project(id: $id) {
      id
      initialFiscalYearAllocation {
        value
        canRead
        canEdit
      }
    }
  }
`);

const UpdateEstimatedSubmissionDoc = graphql(`
  mutation UpdateEstimatedSubmission($input: UpdateProject!) {
    updateProject(input: $input) {
      project {
        id
        estimatedSubmission {
          value
        }
      }
    }
  }
`);

const CreateProjectMemberDoc = graphql(`
  mutation AddProjectMember($input: CreateProjectMember!) {
    createProjectMember(input: $input) {
      projectMember {
        id
      }
    }
  }
`);

const TransitionProjectDoc = graphql(`
  mutation ForceProjectStep($input: ExecuteProjectTransition!) {
    transitionProject(input: $input) {
      project {
        status
      }
    }
  }
`);

const ListSortedDoc = graphql(`
  query ProjectsByInitialFiscalYearAllocation($input: ProjectListInput) {
    projects(input: $input) {
      items {
        id
      }
    }
  }
`);
