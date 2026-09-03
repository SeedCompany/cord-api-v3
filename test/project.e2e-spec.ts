import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { intersection, times } from 'lodash';
import { v1 as uuid } from 'uuid';
import {
  CalendarDate,
  generateId,
  type ID,
  isIdLike,
  Order,
  Role,
  Sensitivity,
} from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { externalDepartmentIds } from '~/core/drizzle/schema';
import { DatabaseService } from '~/core/neo4j';
import { graphql, type InputOf } from '~/graphql';
import { BudgetStatus } from '../src/components/budget/dto';
import { PartnerType } from '../src/components/partner/dto';
import { ProjectType } from '../src/components/project/dto';
import {
  createFundingAccount,
  createInternshipEngagement,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createOrganization,
  createPartner,
  createPartnership,
  createPerson,
  createPin,
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  createTool,
  createZone,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';
import {
  forceProjectTo,
  transitionProject,
} from './utility/transition-project';

const deleteProject =
  (app: TestApp) => async (id: ID | string | { id: ID | string }) =>
    await app.graphql.mutate(
      graphql(`
        mutation DeleteProject($id: ID!) {
          deleteProject(id: $id) {
            __typename
          }
        }
      `),
      {
        id: isIdLike(id) || typeof id === 'string' ? (id as ID) : (id.id as ID),
      },
    );

const listProjects = async (
  app: TestApp,
  input?: InputOf<typeof ProjectListDoc>,
) => {
  const { projects } = await app.graphql.query(ProjectListDoc, { input });
  return projects;
};
const ProjectListDoc = graphql(
  `
    query ProjectList($input: ProjectListInput) {
      projects(input: $input) {
        items {
          ...project
        }
        hasMore
        total
      }
    }
  `,
  [fragments.project],
);

const readDepartmentId = async (app: TestApp, id: ID) => {
  const { project } = await app.graphql.query(
    graphql(`
      query ProjectDepartmentId($id: ID!) {
        project(id: $id) {
          departmentId {
            value
          }
        }
      }
    `),
    { id },
  );
  return project.departmentId.value;
};

describe('Project e2e', () => {
  let app: TestApp;
  let intern: fragments.user;
  let mentor: fragments.user;
  let director: fragments.user;
  let fieldRegion: fragments.fieldRegion;
  let location: fragments.location;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await registerUser(app, {
      roles: [
        Role.ProjectManager,
        Role.LeadFinancialAnalyst,
        Role.FieldOperationsDirector,
      ],
    });

    [location, fieldRegion] = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccount: fundingAccount.id,
      });
      const fieldRegion = await createRegion(app);

      await createZone(app, { director: director.id });

      return [location, fieldRegion];
    });
    intern = director;
    mentor = director;
  });

  it('should have unique name', async () => {
    const name = faker.lorem.word() + ' testProject';
    await createProject(app, { name, fieldRegion: fieldRegion.id });
    await expect(
      createProject(app, { name, fieldRegion: fieldRegion.id }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Project with this name already exists',
        field: 'name',
      }),
    );
  });

  it('create & read project by id', async () => {
    const project = await createProject(app, { fieldRegion: fieldRegion.id });

    const result = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
            }
          }
        `,
        [fragments.project],
      ),
      {
        id: project.id,
      },
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.type).toBe(project.type);
    expect(actual.sensitivity).toBe(project.sensitivity);
    expect(actual.name.value).toBe(project.name.value);
    expect(actual.departmentId.value).toBe(project.departmentId.value);
    expect(actual.step.value).toBe(project.step.value);
    expect(actual.status).toBe(project.status);
    expect(actual.mouStart.value).toBe(project.mouStart.value);
    expect(actual.mouEnd.value).toBe(project.mouEnd.value);
    expect(actual.estimatedSubmission.value).toBe(
      project.estimatedSubmission.value,
    );
    expect(actual.presetInventory.value).toBe(project.presetInventory.value);
  });

  it('create project with required fields', async () => {
    const actual = await createProject(app, {
      mouStart: undefined,
      mouEnd: undefined,
    });
    expect(actual.id).toBeDefined();
    expect(actual.departmentId.value).toBeNull();
    expect(actual.mouStart.value).toBeNull();
    expect(actual.mouEnd.value).toBeNull();
    expect(actual.estimatedSubmission.value).toBeNull();
    expect(actual.engagements.canRead).toBe(true);
    expect(actual.engagements.canCreate).toBe(true);
    expect(actual.partnerships.canRead).toBe(true);
    expect(actual.partnerships.canCreate).toBe(true);
    expect(actual.team.canRead).toBe(true);
    expect(actual.team.canCreate).toBe(true);
    expect(actual.rootDirectory.value!.children.items).toEqual([
      { name: 'Approval Documents' },
      { name: 'Consultant Reports' },
      { name: 'Field Correspondence' },
      { name: 'Photos' },
    ]);
  });

  it('should throw error if the location id is not valid', async () => {
    await expect(
      createProject(app, {
        name: faker.string.uuid(),
        type: ProjectType.MomentumTranslation,
        fieldRegion: uuid() as ID,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: 'Field region not found',
        field: 'fieldRegion',
      }),
    );
  });

  it('adds and removes an other-location from a project', async () => {
    const project = await createProject(app);
    const location = await runAsAdmin(app, () => createLocation(app));

    const ProjectOtherLocations = graphql(`
      query project($id: ID!) {
        project(id: $id) {
          otherLocations {
            items {
              id
            }
          }
        }
      }
    `);

    await app.graphql.mutate(
      graphql(`
        mutation addOtherLocationToProject($project: ID!, $location: ID!) {
          addOtherLocationToProject(project: $project, location: $location) {
            project {
              id
            }
          }
        }
      `),
      { project: project.id, location: location.id },
    );

    const afterAdd = await app.graphql.query(ProjectOtherLocations, {
      id: project.id,
    });
    expect(afterAdd.project.otherLocations.items.map((l) => l.id)).toEqual([
      location.id,
    ]);

    await app.graphql.mutate(
      graphql(`
        mutation removeOtherLocationFromProject($project: ID!, $location: ID!) {
          removeOtherLocationFromProject(
            project: $project
            location: $location
          ) {
            project {
              id
            }
          }
        }
      `),
      { project: project.id, location: location.id },
    );

    const afterRemove = await app.graphql.query(ProjectOtherLocations, {
      id: project.id,
    });
    expect(afterRemove.project.otherLocations.items).toHaveLength(0);
  });

  it('create & read project with budget and field region by id', async () => {
    const res = await app.graphql.mutate(
      graphql(
        `
          mutation createProject($input: CreateProject!) {
            createProject(input: $input) {
              project {
                ...project
                budget {
                  value {
                    ...budget
                  }
                }
                fieldRegion {
                  value {
                    id
                    name {
                      value
                    }
                  }
                }
              }
            }
          }
        `,
        [fragments.project, fragments.budget],
      ),
      {
        input: {
          name: faker.string.uuid(),
          type: ProjectType.MomentumTranslation,
          fieldRegion: fieldRegion.id,
        },
      },
    );
    const project = res.createProject.project;

    const result = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
              budget {
                value {
                  ...budget
                }
              }
              fieldRegion {
                value {
                  id
                  name {
                    value
                  }
                }
              }
            }
          }
        `,
        [fragments.project, fragments.budget],
      ),
      {
        id: project.id,
      },
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.type).toBe(project.type);
    expect(actual.budget.value!.id).toBe(project.budget.value!.id);
    expect(actual.fieldRegion.value!.name.value).toBe(
      project.fieldRegion.value!.name.value,
    );
  });

  it('update project', async () => {
    const project = await createProject(app, { fieldRegion: fieldRegion.id });
    const namenew = faker.lorem.word() + ' Project';

    const result = await app.graphql.query(
      graphql(
        `
          mutation updateProject($id: ID!, $name: String!) {
            updateProject(input: { id: $id, name: $name }) {
              project {
                ...project
              }
            }
          }
        `,
        [fragments.project],
      ),
      {
        id: project.id,
        name: namenew,
      },
    );

    expect(result.updateProject.project.id).toBe(project.id);
    expect(result.updateProject.project.name.value).toBe(namenew);
  });

  it('toggles usesRev79 and filters by it and by tool', async () => {
    // usesRev79 delegates to a ToolUsage against whichever Tool carries the
    // Rev79 key, so a project can't turn it on until that Tool exists.
    const rev79Tool = await runAsAdmin(
      app,
      async () => await createTool(app, { key: 'Rev79' }),
    );
    const project = await createProject(app, {
      type: ProjectType.MomentumTranslation,
      fieldRegion: fieldRegion.id,
    });
    const usesRev79Of = async (id: ID) => {
      const result = await app.graphql.query(
        graphql(`
          query projectUsesRev79($id: ID!) {
            project(id: $id) {
              usesRev79 {
                value
              }
            }
          }
        `),
        { id },
      );
      return result.project.usesRev79.value;
    };
    expect(await usesRev79Of(project.id)).toBe(false);

    const enabled = await app.graphql.mutate(
      graphql(`
        mutation enableRev79($id: ID!) {
          updateProject(input: { id: $id, usesRev79: true }) {
            project {
              usesRev79 {
                value
              }
            }
          }
        }
      `),
      { id: project.id },
    );
    expect(enabled.updateProject.project.usesRev79.value).toBe(true);

    const rev79Filtered = await app.graphql.query(
      graphql(`
        query projectsUsingRev79 {
          projects(input: { filter: { usesRev79: true } }) {
            items {
              id
            }
          }
        }
      `),
    );
    expect(rev79Filtered.projects.items.map((p) => p.id)).toContain(project.id);

    const toolFiltered = await app.graphql.query(
      graphql(`
        query projectsByTool($id: ID!) {
          projects(input: { filter: { tool: { id: $id } } }) {
            items {
              id
            }
          }
        }
      `),
      { id: rev79Tool.id },
    );
    expect(toolFiltered.projects.items.map((p) => p.id)).toContain(project.id);

    const disabled = await app.graphql.mutate(
      graphql(`
        mutation disableRev79($id: ID!) {
          updateProject(input: { id: $id, usesRev79: false }) {
            project {
              usesRev79 {
                value
              }
            }
          }
        }
      `),
      { id: project.id },
    );
    expect(disabled.updateProject.project.usesRev79.value).toBe(false);

    const rev79FilteredAfter = await app.graphql.query(
      graphql(`
        query projectsUsingRev79After {
          projects(input: { filter: { usesRev79: true } }) {
            items {
              id
            }
          }
        }
      `),
    );
    expect(rev79FilteredAfter.projects.items.map((p) => p.id)).not.toContain(
      project.id,
    );
  });

  it('delete project', async () => {
    const project = await createProject(app, { fieldRegion: fieldRegion.id });
    expect(project.id).toBeTruthy();

    // Only for admins, but we'll just run it as one to test functionality.
    await runAsAdmin(app, () => {
      return deleteProject(app)(project.id);
    });

    await app.graphql
      .query(
        graphql(
          `
            query project($id: ID!) {
              project(id: $id) {
                ...project
              }
            }
          `,
          [fragments.project],
        ),
        {
          id: project.id,
        },
      )
      .expectError(errors.notFound());
  });

  // ONE expectation for both databases. A note here used to say Postgres
  // ordered names differently and that the difference was accepted (decision of
  // 2026-06-12). That was measured against the `postgres:16-alpine` image and
  // was wrong twice over: alpine links musl, which has no locale-aware
  // collation, so `en_US.utf8` there falls back to raw byte ordering — and a
  // glibc Postgres with the same collation name orders names exactly as Neo4j
  // does. So the "difference" was a property of the image, not of Postgres.
  //
  // Rather than depend on the image, every text sort now names the
  // `display_order` collation explicitly (migration 0032, applied by
  // displayOrder() in src/core/drizzle/order-by.ts). That produces this ordering
  // on alpine, on glibc, and across OS upgrades — so this asserts that the two
  // databases genuinely agree, rather than making a separate claim about each.
  //
  // If this starts failing with capitals grouped ahead of lowercase and `Ñot a
  // project` last, a text sort lost that collation. Check that before changing
  // these expectations.
  it('List of projects sorted by name to be alphabetical', async () => {
    const unsorted = [
      'A ignore spaces',
      'ABC',
      '[a!-ignore-punctuation]',
      'Ñot a project',
      'another project 2',
      'zap zap',
      'never a project',
    ];
    const sorted = [
      'ABC',
      '[a!-ignore-punctuation]', // ignores punctuation & case sensitivity
      'A ignore spaces', // ignores spaces
      'another project 2',
      'never a project',
      'Ñot a project', // ignores special characters
      'zap zap',
    ];

    await Promise.all(
      unsorted.map(async (name) => {
        return await createProject(app, {
          name,
          type: ProjectType.MomentumTranslation,
          fieldRegion: fieldRegion.id,
        });
      }),
    );

    // only be concerned with projects listed here,
    // ignore other ones that have slipped in from other tests
    const filterNames = (list: typeof ascProjects) =>
      intersection(
        list.items.map((p) => p.name.value),
        unsorted,
      );

    const ascProjects = await listProjects(app, {
      sort: 'name',
      order: Order.ASC,
    });
    expect(filterNames(ascProjects)).toEqual(sorted);

    const descProjects = await listProjects(app, {
      sort: 'name',
      order: Order.DESC,
    });
    expect(filterNames(descProjects)).toEqual(sorted.slice().reverse());
  });

  it('List view of projects', async () => {
    // create 2 projects
    const numProjects = 2;
    const type = ProjectType.MomentumTranslation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
            fieldRegion: fieldRegion.id,
          }),
      ),
    );

    const { projects } = await app.graphql.query(
      graphql(
        `
          query projects($type: [ProjectType!]) {
            projects(input: { filter: { type: $type } }) {
              items {
                ...project
              }
              hasMore
              total
            }
          }
        `,
        [fragments.project],
      ),
      {
        type: [type],
      },
    );
    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);
  });

  it('filters projects by field region name', async () => {
    const matchingRegion = await runAsAdmin(
      app,
      async () => await createRegion(app, { name: 'Amazonia Region' }),
    );
    const otherRegion = await runAsAdmin(
      app,
      async () => await createRegion(app, { name: 'Baltic Region' }),
    );

    const matchingProject = await createProject(app, {
      name: 'Project in Amazonia ' + (await generateId()),
      fieldRegion: matchingRegion.id,
    });
    const otherProject = await createProject(app, {
      name: 'Project in Baltic ' + (await generateId()),
      fieldRegion: otherRegion.id,
    });

    const projects = await listProjects(app, {
      filter: {
        fieldRegion: {
          name: 'am',
        },
      },
    });

    expect(projects.items.map((project) => project.id)).toContain(
      matchingProject.id,
    );
    expect(projects.items.map((project) => project.id)).not.toContain(
      otherProject.id,
    );
  });

  it('List of projects sorted by Sensitivity', async () => {
    //Create three intern projects of different sensitivities
    await createProject(app, {
      name: 'High Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.High,
      fieldRegion: fieldRegion.id,
    });

    await createProject(app, {
      name: 'Low Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.Low,
      fieldRegion: fieldRegion.id,
    });

    await createProject(app, {
      name: 'Med Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.Medium,
      fieldRegion: fieldRegion.id,
    });

    // Create two translation projects, one without language engagements and
    // one with 1 med and 1 low sensitivity eng translation project without engagements
    await createProject(app, { fieldRegion: fieldRegion.id });

    //with engagements, low and med sensitivity, project should eval to med
    const translationProjectWithEngagements = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });

    const [medSensitivityLanguage, lowSensitivityLanguage] = await runAsAdmin(
      app,
      async () => [
        await createLanguage(app, { sensitivity: Sensitivity.Medium }),
        await createLanguage(app, { sensitivity: Sensitivity.Low }),
      ],
    );

    await createLanguageEngagement(app, {
      project: translationProjectWithEngagements.id,
      language: lowSensitivityLanguage.id,
    });

    await createLanguageEngagement(app, {
      project: translationProjectWithEngagements.id,
      language: medSensitivityLanguage.id,
    });

    const getSensitivitySortedProjects = async (order: 'ASC' | 'DESC') =>
      await app.graphql.query(
        graphql(`
          query projects($input: ProjectListInput!) {
            projects(input: $input) {
              hasMore
              total
              items {
                id
                sensitivity
              }
            }
          }
        `),
        {
          input: {
            sort: 'sensitivity',
            order,
          },
        },
      );
    const getSortedSensitivities = (projects: typeof ascendingProjects) =>
      projects.items.map((project) => project.sensitivity);

    const { projects: ascendingProjects } =
      await getSensitivitySortedProjects('ASC');

    expect(ascendingProjects.items.length).toBeGreaterThanOrEqual(5);

    expect(getSortedSensitivities(ascendingProjects)).toEqual(
      expect.arrayContaining([
        Sensitivity.Low,
        Sensitivity.Medium,
        Sensitivity.Medium,
        Sensitivity.High,
        Sensitivity.High,
      ]),
    );

    const { projects: descendingProjects } =
      await getSensitivitySortedProjects('DESC');

    expect(getSortedSensitivities(descendingProjects)).toEqual(
      expect.arrayContaining([
        Sensitivity.High,
        Sensitivity.High,
        Sensitivity.Medium,
        Sensitivity.Medium,
        Sensitivity.Low,
      ]),
    );
  });

  it('List view of my projects', async () => {
    const numProjects = 2;
    const type = ProjectType.MomentumTranslation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
            fieldRegion: fieldRegion.id,
          }),
      ),
    );

    const { projects } = await app.graphql.query(
      graphql(
        `
          query projects {
            projects(input: { filter: { mine: true } }) {
              items {
                ...project
              }
              hasMore
              total
            }
          }
        `,
        [fragments.project],
      ),
    );

    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);
  });

  it('List view of pinned/unpinned projects', async () => {
    const numProjects = 2;
    const type = ProjectType.MomentumTranslation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
            fieldRegion: fieldRegion.id,
          }),
      ),
    );
    const project = await createProject(app, { fieldRegion: fieldRegion.id });
    await createPin(app, project.id, true);

    // filter pinned projects
    const { projects: pinnedProjects } = await app.graphql.query(
      graphql(
        `
          query projects {
            projects(input: { filter: { pinned: true } }) {
              items {
                ...project
              }
              hasMore
              total
            }
          }
        `,
        [fragments.project],
      ),
    );

    expect(pinnedProjects.items.length).toBe(1);
    expect(pinnedProjects.items[0]!.id).toBe(project.id);

    // filter unpinned projects
    const { projects: unpinnedProjects } = await app.graphql.query(
      graphql(
        `
          query projects {
            projects(input: { filter: { pinned: false } }) {
              items {
                ...project
              }
              hasMore
              total
            }
          }
        `,
        [fragments.project],
      ),
    );

    expect(unpinnedProjects.items.length).toBeGreaterThanOrEqual(numProjects);
    // pinned project should be excluded
    const result = unpinnedProjects.items.find(({ id }) => id === project.id);
    expect(result).toBeUndefined();
  });

  it('List view of presetInventory projects', async () => {
    const numProjects = 2;
    const type = ProjectType.MomentumTranslation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
            presetInventory: true,
            fieldRegion: fieldRegion.id,
          }),
      ),
    );

    const { projects } = await app.graphql.query(
      graphql(
        `
          query projects {
            projects(input: { filter: { presetInventory: true } }) {
              items {
                ...project
              }
              hasMore
              total
            }
          }
        `,
        [fragments.project],
      ),
    );

    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);
  });

  it('Project engagement and sensitivity connected to language engagements', async () => {
    // create 1 engagements in a project
    const numEngagements = 1;
    const project = await createProject(app, { fieldRegion: fieldRegion.id });
    const language = await runAsAdmin(app, async () => {
      return await createLanguage(app, { sensitivity: Sensitivity.Medium });
    });
    await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
    });

    const queryProject = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
              engagements {
                items {
                  ...languageEngagement
                }
                hasMore
                total
              }
            }
          }
        `,
        [fragments.project, fragments.languageEngagement],
      ),
      {
        id: project.id,
      },
    );
    expect(
      queryProject.project.engagements.items.length,
    ).toBeGreaterThanOrEqual(numEngagements);

    expect(queryProject.project.sensitivity).toEqual(language.sensitivity);
  });

  it('List view of internship engagement', async () => {
    //create 1 engagements in a project
    const numEngagements = 1;
    const type = ProjectType.Internship;

    const project = await createProject(app, {
      type,
      fieldRegion: fieldRegion.id,
    });

    await createInternshipEngagement(app, {
      mentor: mentor.id,
      project: project.id,
      intern: intern.id,
      countryOfOrigin: location.id,
    });
    const queryProject = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
              engagements {
                items {
                  ...internshipEngagement
                }
                hasMore
                total
              }
            }
          }
        `,
        [fragments.project, fragments.internshipEngagement],
      ),
      {
        id: project.id,
      },
    );
    expect(
      queryProject.project.engagements.items.length,
    ).toBeGreaterThanOrEqual(numEngagements);
  });

  it('List view of project members by projectId', async () => {
    //create 2 Project member
    const numProjectMembers = 2;
    const project = await createProject(app, { fieldRegion: fieldRegion.id });

    await runAsAdmin(app, async () => {
      await Promise.all(
        times(numProjectMembers, async () => {
          const user = await createPerson(app, { roles: [Role.Consultant] });
          await createProjectMember(app, {
            user: user.id,
            project: project.id,
            roles: [Role.Consultant],
          });
        }),
      );
    });

    const queryProject = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
              team {
                items {
                  ...projectMember
                }
                hasMore
                total
              }
            }
          }
        `,
        [fragments.project, fragments.projectMember],
      ),
      {
        id: project.id,
      },
    );

    // Remember the project Owner is also a team member so that should be +1
    expect(queryProject.project.team.items.length).toBe(numProjectMembers + 1);
    expect(queryProject.project.team.total).toBe(numProjectMembers + 1);
  });

  it('List view of partnerships by projectId', async () => {
    //create 2 partnerships in a project
    const numPartnerships = 2;
    const type = ProjectType.MomentumTranslation;
    const project = await createProject(app, {
      type,
      fieldRegion: fieldRegion.id,
    });

    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          project: project.id,
        }),
      ),
    );

    const queryProject = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
              partnerships {
                items {
                  ...partnership
                }
                hasMore
                total
              }
            }
          }
        `,
        [fragments.project, fragments.partnership],
      ),
      {
        id: project.id,
      },
    );

    expect(
      queryProject.project.partnerships.items.length,
    ).toBeGreaterThanOrEqual(numPartnerships);
    expect(queryProject.project.partnerships.total).toBe(numPartnerships);
  });

  it('Should have a current budget when made active', async () => {
    await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccount: fundingAccount.id,
      });
      const project = await createProject(app, {
        primaryLocation: location.id,
        fieldRegion: fieldRegion.id,
      });

      const {
        step: { transitions },
      } = await forceProjectTo(app, project.id, 'PendingFinanceConfirmation');

      // Ensure the result from the change to Active returns the correct budget status
      const { transitionProject } = await app.graphql.mutate(
        graphql(`
          mutation updateProject($input: ExecuteProjectTransition!) {
            transitionProject(input: $input) {
              project {
                departmentId {
                  value
                }
                initialMouEnd {
                  value
                }
                budget {
                  value {
                    status
                  }
                }
              }
            }
          }
        `),
        {
          input: {
            project: project.id,
            transition: transitions.find((t) => t.to === 'Active')?.key,
          },
        },
      );
      const { project: updatedProject } = transitionProject;

      expect(updatedProject.budget.value!.status).toBe(BudgetStatus.Current);
      // TODO move this assertion
      expect(updatedProject.departmentId.value).toContain(
        fundingAccount.accountNumber.value?.toString(),
      );
      // TODO move this assertion
      expect(updatedProject.initialMouEnd.value).toBe(project.mouEnd.value);
    });
  });

  describe('marketingRegion', () => {
    const readMarketingRegion = async (id: ID) => {
      const result = await app.graphql.query(
        graphql(`
          query projectMarketingRegion($id: ID!) {
            project(id: $id) {
              marketingRegion {
                canRead
                value {
                  id
                }
              }
            }
          }
        `),
        { id },
      );
      return result.project.marketingRegion;
    };

    /** A project whose marketing location carries a default region. */
    const createProjectWithMarketingLocation = async () => {
      const locationDefaultRegion = await createLocation(app);
      const marketingLocation = await createLocation(app, {
        defaultMarketingRegion: locationDefaultRegion.id,
      });
      const project = await createProject(app, {
        marketingLocation: marketingLocation.id,
        fieldRegion: fieldRegion.id,
      });
      return { project, locationDefaultRegion };
    };

    it('comes from the marketing location when nothing overrides it', async () => {
      await runAsAdmin(app, async () => {
        const { project, locationDefaultRegion } =
          await createProjectWithMarketingLocation();

        const marketingRegion = await readMarketingRegion(project.id);
        expect(marketingRegion.canRead).toBe(true);
        expect(marketingRegion.value?.id).toBe(locationDefaultRegion.id);
      });
    });

    it('uses the override in place of the marketing location default', async () => {
      await runAsAdmin(app, async () => {
        const { project, locationDefaultRegion } =
          await createProjectWithMarketingLocation();
        const overrideRegion = await createLocation(app);

        await app.graphql.mutate(
          graphql(`
            mutation setMarketingRegionOverride($input: UpdateProject!) {
              updateProject(input: $input) {
                project {
                  id
                }
              }
            }
          `),
          {
            input: {
              id: project.id,
              marketingRegionOverride: overrideRegion.id,
            },
          },
        );

        // The marketing location still has its own default, so this is about
        // which one wins rather than whether the override can be read at all.
        const marketingRegion = await readMarketingRegion(project.id);
        expect(marketingRegion.value?.id).toBe(overrideRegion.id);
        expect(marketingRegion.value?.id).not.toBe(locationDefaultRegion.id);
      });
    });
  });

  // #727 create without mouStart, mouEnd, estimatedSubmission
  it('can create without mouStart, mouEnd and estimatedSubmission', async () => {
    const { createProject } = await app.graphql.mutate(
      graphql(
        `
          mutation createProject($input: CreateProject!) {
            createProject(input: $input) {
              project {
                ...project
              }
            }
          }
        `,
        [fragments.project],
      ),
      {
        input: {
          name: faker.string.uuid(),
          type: ProjectType.MomentumTranslation,
          fieldRegion: fieldRegion.id,
        },
      },
    );
    expect(createProject.project.id).toBeDefined();
  });

  it('can create without mouStart, if mouEnd is defined', async () => {
    const { createProject } = await app.graphql.mutate(
      graphql(
        `
          mutation createProject($input: CreateProject!) {
            createProject(input: $input) {
              project {
                ...project
              }
            }
          }
        `,
        [fragments.project],
      ),
      {
        input: {
          name: faker.string.uuid(),
          type: 'MomentumTranslation',
          mouEnd: '1992-11-01',
          estimatedSubmission: '1993-11-01',
          fieldRegion: fieldRegion.id,
        },
      },
    );

    expect(createProject.project.id).toBeDefined();
  });

  /**
   * It should create Partnership with Funding type before creating Project
   * Update Project's mou dates and check if the budget records are created.
   */
  it('should create budget records after updating project with mou dates', async () => {
    const org = await createOrganization(app);
    const proj = await createProject(app, {
      name: faker.string.uuid() + ' project',
      mouStart: undefined,
      mouEnd: undefined,
      fieldRegion: fieldRegion.id,
    });

    // Create Partnership with Funding type
    await app.graphql.mutate(
      graphql(
        `
          mutation createPartnership($input: CreatePartnership!) {
            createPartnership(input: $input) {
              partnership {
                ...partnership
              }
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        input: {
          project: proj.id,
          partner: (await createPartner(app, { organization: org.id })).id,
          types: ['Funding'],
        },
      },
    );

    // Update Project with mou dates
    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateProject($id: ID!, $mouStart: Date!, $mouEnd: Date!) {
            updateProject(
              input: { id: $id, mouStart: $mouStart, mouEnd: $mouEnd }
            ) {
              project {
                ...project
                budget {
                  value {
                    id
                    records {
                      id
                    }
                  }
                }
              }
            }
          }
        `,
        [fragments.project],
      ),
      {
        id: proj.id,
        mouStart: CalendarDate.fromISO('2020-08-23').toISO(),
        mouEnd: CalendarDate.fromISO('2021-08-22').toISO(),
      },
    );

    const actual = result.updateProject.project;
    expect(actual.id).toBe(proj.id);
    expect(actual.budget.value!.records.length).toBe(2);
  });

  /**
   * After creating a partnership, should be able to query project and get organization
   */
  it('after creating a partnership, should be able to query project and get organization', async () => {
    const org = await createOrganization(app);
    const project = await createProject(app, {
      name: faker.string.uuid() + ' project',
      fieldRegion: fieldRegion.id,
    });
    await app.graphql.mutate(
      graphql(
        `
          mutation createPartnership($input: CreatePartnership!) {
            createPartnership(input: $input) {
              partnership {
                ...partnership
              }
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        input: {
          project: project.id,
          partner: (await createPartner(app, { organization: org.id })).id,
          types: [PartnerType.Funding],
        },
      },
    );

    const projectQueryResult = await app.graphql.query(
      graphql(`
        query project($id: ID!) {
          project(id: $id) {
            budget {
              value {
                records {
                  organization {
                    value {
                      id
                      name {
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `),
      {
        id: project.id,
      },
    );
    const firstBudgetRecordOrganizationId =
      projectQueryResult.project.budget.value!.records[0]!.organization.value!
        .id;
    expect(firstBudgetRecordOrganizationId).toBe(org.id);
  });

  it('should not assign the same department id to two projects created with the same location', async () => {
    await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccount: fundingAccount.id,
      });

      const createAndUpdateProject = async (name: string) => {
        const project = await createProject(app, {
          name,
          primaryLocation: location.id,
          fieldRegion: fieldRegion.id,
        });
        const { transitionProject } = await app.graphql.mutate(
          graphql(`
            mutation updateProject($id: ID!) {
              transitionProject(
                # updating to this step assigns a dept id
                input: { project: $id, bypassTo: PendingFinanceConfirmation }
              ) {
                project {
                  departmentId {
                    value
                  }
                }
              }
            }
          `),
          {
            id: project.id,
          },
        );
        return transitionProject.project;
      };
      const [project1, project2] = await runAsAdmin(app, () =>
        Promise.all(
          ['1', '2'].map(async (i) => await createAndUpdateProject(i)),
        ),
      );

      expect(project1!.departmentId.value).not.toBe(
        project2!.departmentId.value,
      );
    });
  });

  // Placed at the end of the file, not alongside the other filter tests
  // above: these create extra projects with no explicit sensitivity (default
  // High), which threw off "List of projects sorted by Sensitivity"'s exact
  // top-of-list assertion when they ran earlier in file order.
  it('isMember filter scopes to the CURRENT user, not any project with any active member', async () => {
    // Found live 2026-08-07 impersonating a Financial Analyst: `mine`
    // returned 5240 projects locally vs 116 in prod for the same persona.
    // FinancialAnalystPolicy grants unconditional Project.read (no
    // `.when(member)`), so unlike most roles — where the read-filter itself
    // already restricts every row to "projects I'm a member of" and made the
    // missing constraint invisible — this role exposed it directly.
    const myProject = await createProject(app, { fieldRegion: fieldRegion.id });
    const otherProject = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });

    // registerUser leaves the ambient session as the new user afterward (by
    // design — many tests rely on it), so it and the member-adding both go
    // inside ONE runAsAdmin call: it restores whatever was ambient (director)
    // BEFORE this call started, undoing that churn, rather than leaving the
    // analyst as ambient for every test after this one.
    const analyst = await runAsAdmin(app, async () => {
      const user = await registerUser(app, {
        roles: [Role.FinancialAnalyst],
      });
      await createProjectMember(app, {
        project: myProject.id,
        user: user.id,
      });
      // otherProject already has director as an active member — createProject
      // auto-adds its creator — which is exactly the case that must NOT match:
      // some other user's active membership, not this requester's.
      return user;
    });

    const mine = await analyst.runAs(() =>
      listProjects(app, { filter: { isMember: true } }),
    );
    const ids = mine.items.map((p) => p.id);
    expect(ids).toContain(myProject.id);
    expect(ids).not.toContain(otherProject.id);
  });

  it('filters projects by onlyMultipleEngagements — false means exactly one, not zero-or-one', async () => {
    const noEngagements = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });
    const oneEngagement = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });
    const twoEngagements = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });

    const [languageA, languageB] = await runAsAdmin(app, async () => [
      await createLanguage(app),
      await createLanguage(app),
    ]);

    // Match createProject()'s default MOU window (1991–1992) instead of
    // letting these fall back to today's date, which sits outside it.
    const startDateOverride = CalendarDate.fromISO('1991-01-01').toISO();
    const endDateOverride = CalendarDate.fromISO('1992-01-01').toISO();
    await createLanguageEngagement(app, {
      project: oneEngagement.id,
      language: languageA.id,
      startDateOverride,
      endDateOverride,
    });
    await createLanguageEngagement(app, {
      project: twoEngagements.id,
      language: languageA.id,
      startDateOverride,
      endDateOverride,
    });
    await createLanguageEngagement(app, {
      project: twoEngagements.id,
      language: languageB.id,
      startDateOverride,
      endDateOverride,
    });

    const multiple = await listProjects(app, {
      filter: { onlyMultipleEngagements: true },
    });
    const multipleIds = multiple.items.map((p) => p.id);
    expect(multipleIds).toContain(twoEngagements.id);
    expect(multipleIds).not.toContain(oneEngagement.id);
    expect(multipleIds).not.toContain(noEngagements.id);

    const exactlyOne = await listProjects(app, {
      filter: { onlyMultipleEngagements: false },
    });
    const exactlyOneIds = exactlyOne.items.map((p) => p.id);
    expect(exactlyOneIds).toContain(oneEngagement.id);
    expect(exactlyOneIds).not.toContain(twoEngagements.id);
    expect(exactlyOneIds).not.toContain(noEngagements.id);
  });

  it("filters a partner's projects to those with a partnership to that partner", async () => {
    // ProjectFilters.partnerId has no GraphQL field — it's injected by the
    // Partner.projects resolver, same as cord-field's PartnerProjects.graphql
    // (partner(id) { projects(input) }), not settable directly by a client.
    const matchingPartner = await createPartner(app);
    const otherPartner = await createPartner(app);

    const matchingProject = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });
    const otherProject = await createProject(app, {
      fieldRegion: fieldRegion.id,
    });

    await createPartnership(app, {
      project: matchingProject.id,
      partner: matchingPartner.id,
    });
    await createPartnership(app, {
      project: otherProject.id,
      partner: otherPartner.id,
    });

    const { partner } = await app.graphql.query(
      graphql(`
        query ($id: ID!) {
          partner(id: $id) {
            id
            projects(input: {}) {
              items {
                id
              }
            }
          }
        }
      `),
      { id: matchingPartner.id },
    );

    const ids = partner.projects.items.map((p) => p.id);
    expect(ids).toContain(matchingProject.id);
    expect(ids).not.toContain(otherProject.id);
  });

  it('assigns a department id to a MultiplicationTranslation project via its primary partnership', async () => {
    await runAsAdmin(app, async () => {
      const partner = await createPartner(app, {
        departmentIdBlock: { blocks: '500000-500009' },
      });
      const project = await createProject(app, {
        type: ProjectType.MultiplicationTranslation,
        fieldRegion: fieldRegion.id,
      });
      await createPartnership(app, {
        project: project.id,
        partner: partner.id,
      });

      await forceProjectTo(app, project.id, 'PendingFinanceConfirmation');
      const departmentId = await readDepartmentId(app, project.id);

      expect(departmentId).toBeTruthy();
      expect(Number(departmentId)).toBeGreaterThanOrEqual(500000);
      expect(Number(departmentId)).toBeLessThanOrEqual(500009);
    });
  });

  it('does not assign the same department id to two MultiplicationTranslation projects sharing a partner', async () => {
    await runAsAdmin(app, async () => {
      const partner = await createPartner(app, {
        departmentIdBlock: { blocks: '500100-500109' },
      });

      const createAndUpdateProject = async (name: string) => {
        const project = await createProject(app, {
          name,
          type: ProjectType.MultiplicationTranslation,
          fieldRegion: fieldRegion.id,
        });
        await createPartnership(app, {
          project: project.id,
          partner: partner.id,
        });
        // Not forceProjectTo here: it opens its own isolated admin session,
        // which races with the shared app.graphql.authToken when two of
        // these run concurrently under Promise.all below. The outer
        // runAsAdmin already has us authenticated, so transition directly.
        await transitionProject(app, {
          project: project.id,
          bypassTo: 'PendingFinanceConfirmation',
        });
        return await readDepartmentId(app, project.id);
      };
      const [departmentId1, departmentId2] = await Promise.all(
        ['multi-1', 'multi-2'].map(
          async (name) => await createAndUpdateProject(name),
        ),
      );

      expect(departmentId1).not.toBe(departmentId2);
    });
  });

  it('skips a department id that Intacct already holds', async () => {
    // Deliberately NOT gated to one engine. The bug this guards against is the
    // two engines disagreeing: Neo4j has unioned the externally reserved ids
    // into the unavailable set since 2025-09, and the Postgres path shipped
    // without that arm. A Postgres-only test would pass on either behaviour of
    // the Neo4j path and so could not have caught the divergence.
    //
    // The reservation is seeded directly because there is no API for it — it is
    // a flat list loaded from an Intacct export, with no resolver, service or
    // DTO on either engine.
    const reserved = '500200';
    await runAsAdmin(app, async () => {
      const partner = await createPartner(app, {
        // The reserved id is the FIRST in the block, so the allocator returns it
        // unless it is excluded. Without the exclusion this test reads 500200.
        departmentIdBlock: { blocks: '500200-500209' },
      });

      if (process.env.DATABASE === 'postgres') {
        await app
          .get(DrizzleService)
          .client.insert(externalDepartmentIds)
          .values({ departmentId: reserved, name: 'Reserved in Intacct' })
          .onConflictDoNothing();
      } else {
        await app
          .get(DatabaseService)
          .query()
          .raw(
            `CREATE (:ExternalDepartmentId {
               id: $id, departmentId: $departmentId,
               name: $name, createdAt: datetime()
             })`,
            {
              id: await generateId(),
              departmentId: reserved,
              name: 'Reserved in Intacct',
            },
          )
          .run();
      }

      const project = await createProject(app, {
        type: ProjectType.MultiplicationTranslation,
        fieldRegion: fieldRegion.id,
      });
      await createPartnership(app, {
        project: project.id,
        partner: partner.id,
      });

      await forceProjectTo(app, project.id, 'PendingFinanceConfirmation');
      const departmentId = await readDepartmentId(app, project.id);

      expect(departmentId).not.toBe(reserved);
      // Exactly the next one, not merely "something else" — that pins the
      // allocator to skipping only the reserved id rather than the whole block.
      expect(departmentId).toBe('500201');
    });
  });

  it('throws a clear error transitioning a MultiplicationTranslation project with no primary partnership', async () => {
    await runAsAdmin(app, async () => {
      const project = await createProject(app, {
        type: ProjectType.MultiplicationTranslation,
        fieldRegion: fieldRegion.id,
      });

      await expect(
        forceProjectTo(app, project.id, 'PendingFinanceConfirmation'),
      ).rejects.toThrowGqlError({
        code: 'Client',
        message: 'Project must have a partnership to continue',
      });
    });
  });
});
