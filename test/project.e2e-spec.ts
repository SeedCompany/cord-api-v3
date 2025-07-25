import { faker } from '@faker-js/faker';
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
  createZone,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';
import { forceProjectTo } from './utility/transition-project';

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
        fundingAccountId: fundingAccount.id,
      });
      const fieldRegion = await createRegion(app);

      await createZone(app, { directorId: director.id });

      return [location, fieldRegion];
    });
    intern = director;
    mentor = director;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have unique name', async () => {
    const name = faker.lorem.word() + ' testProject';
    await createProject(app, { name, fieldRegionId: fieldRegion.id });
    await expect(
      createProject(app, { name, fieldRegionId: fieldRegion.id }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Project with this name already exists',
        field: 'project.name',
      }),
    );
  });

  it('create & read project by id', async () => {
    const project = await createProject(app, { fieldRegionId: fieldRegion.id });

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
        fieldRegionId: uuid() as ID,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: 'Field region not found',
        field: 'project.fieldRegionId',
      }),
    );
  });

  it('create & read project with budget and field region by id', async () => {
    const res = await app.graphql.mutate(
      graphql(
        `
          mutation createProject($input: CreateProjectInput!) {
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
          project: {
            name: faker.string.uuid(),
            type: ProjectType.MomentumTranslation,
            fieldRegionId: fieldRegion.id,
          },
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
    const project = await createProject(app, { fieldRegionId: fieldRegion.id });
    const namenew = faker.lorem.word() + ' Project';

    const result = await app.graphql.query(
      graphql(
        `
          mutation updateProject($id: ID!, $name: String!) {
            updateProject(input: { project: { id: $id, name: $name } }) {
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

  it('delete project', async () => {
    const project = await createProject(app, { fieldRegionId: fieldRegion.id });
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
          fieldRegionId: fieldRegion.id,
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
            fieldRegionId: fieldRegion.id,
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

  it('List of projects sorted by Sensitivity', async () => {
    //Create three intern projects of different sensitivities
    await createProject(app, {
      name: 'High Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.High,
      fieldRegionId: fieldRegion.id,
    });

    await createProject(app, {
      name: 'Low Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.Low,
      fieldRegionId: fieldRegion.id,
    });

    await createProject(app, {
      name: 'Med Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.Medium,
      fieldRegionId: fieldRegion.id,
    });

    // Create two translation projects, one without language engagements and
    // one with 1 med and 1 low sensitivity eng translation project without engagements
    await createProject(app, { fieldRegionId: fieldRegion.id });

    //with engagements, low and med sensitivity, project should eval to med
    const translationProjectWithEngagements = await createProject(app, {
      fieldRegionId: fieldRegion.id,
    });

    const [medSensitivityLanguage, lowSensitivityLanguage] = await runAsAdmin(
      app,
      async () => [
        await createLanguage(app, { sensitivity: Sensitivity.Medium }),
        await createLanguage(app, { sensitivity: Sensitivity.Low }),
      ],
    );

    await createLanguageEngagement(app, {
      projectId: translationProjectWithEngagements.id,
      languageId: lowSensitivityLanguage.id,
    });

    await createLanguageEngagement(app, {
      projectId: translationProjectWithEngagements.id,
      languageId: medSensitivityLanguage.id,
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

    const { projects: ascendingProjects } = await getSensitivitySortedProjects(
      'ASC',
    );

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

    const { projects: descendingProjects } = await getSensitivitySortedProjects(
      'DESC',
    );

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
            fieldRegionId: fieldRegion.id,
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
            fieldRegionId: fieldRegion.id,
          }),
      ),
    );
    const project = await createProject(app, { fieldRegionId: fieldRegion.id });
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
            fieldRegionId: fieldRegion.id,
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
    const project = await createProject(app, { fieldRegionId: fieldRegion.id });
    const language = await runAsAdmin(app, async () => {
      return await createLanguage(app, { sensitivity: Sensitivity.Medium });
    });
    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
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
      fieldRegionId: fieldRegion.id,
    });

    await createInternshipEngagement(app, {
      mentorId: mentor.id,
      projectId: project.id,
      internId: intern.id,
      countryOfOriginId: location.id,
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
    const project = await createProject(app, { fieldRegionId: fieldRegion.id });
    const projectId = project.id;

    await runAsAdmin(app, async () => {
      await Promise.all(
        times(numProjectMembers, async () => {
          const user = await createPerson(app, { roles: [Role.Consultant] });
          await createProjectMember(app, {
            userId: user.id,
            projectId,
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
      fieldRegionId: fieldRegion.id,
    });

    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          projectId: project.id,
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
        fundingAccountId: fundingAccount.id,
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
        fieldRegionId: fieldRegion.id,
      });

      const {
        step: { transitions },
      } = await forceProjectTo(app, project.id, 'PendingFinanceConfirmation');

      // Ensure the result from the change to Active returns the correct budget status
      const { updatedProject } = await app.graphql.mutate(
        graphql(`
          mutation updateProject($input: ExecuteProjectTransitionInput!) {
            updatedProject: transitionProject(input: $input) {
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
        `),
        {
          input: {
            project: project.id,
            transition: transitions.find((t) => t.to === 'Active')?.key,
          },
        },
      );

      expect(updatedProject.budget.value!.status).toBe(BudgetStatus.Current);
      // TODO move this assertion
      expect(updatedProject.departmentId.value).toContain(
        fundingAccount.accountNumber.value?.toString(),
      );
      // TODO move this assertion
      expect(updatedProject.initialMouEnd.value).toBe(project.mouEnd.value);
    });
  });

  // #727 create without mouStart, mouEnd, estimatedSubmission
  it('can create without mouStart, mouEnd and estimatedSubmission', async () => {
    const { createProject } = await app.graphql.mutate(
      graphql(
        `
          mutation createProject($input: CreateProjectInput!) {
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
          project: {
            name: faker.string.uuid(),
            type: ProjectType.MomentumTranslation,
            fieldRegionId: fieldRegion.id,
          },
        },
      },
    );
    expect(createProject.project.id).toBeDefined();
  });

  it('can create without mouStart, if mouEnd is defined', async () => {
    const { createProject } = await app.graphql.mutate(
      graphql(
        `
          mutation createProject($input: CreateProjectInput!) {
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
          project: {
            name: faker.string.uuid(),
            type: 'MomentumTranslation',
            mouEnd: '1992-11-01',
            estimatedSubmission: '1993-11-01',
            fieldRegionId: fieldRegion.id,
          },
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
      fieldRegionId: fieldRegion.id,
    });

    // Create Partnership with Funding type
    await app.graphql.mutate(
      graphql(
        `
          mutation createPartnership($input: CreatePartnershipInput!) {
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
          partnership: {
            projectId: proj.id,
            partnerId: (
              await createPartner(app, { organizationId: org.id })
            ).id,
            types: ['Funding'],
          },
        },
      },
    );

    // Update Project with mou dates
    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateProject($id: ID!, $mouStart: Date!, $mouEnd: Date!) {
            updateProject(
              input: {
                project: { id: $id, mouStart: $mouStart, mouEnd: $mouEnd }
              }
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
      fieldRegionId: fieldRegion.id,
    });
    await app.graphql.mutate(
      graphql(
        `
          mutation createPartnership($input: CreatePartnershipInput!) {
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
          partnership: {
            projectId: project.id,
            partnerId: (
              await createPartner(app, { organizationId: org.id })
            ).id,
            types: [PartnerType.Funding],
          },
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
        fundingAccountId: fundingAccount.id,
      });

      const createAndUpdateProject = async (name: string) => {
        const project = await createProject(app, {
          name,
          primaryLocationId: location.id,
          fieldRegionId: fieldRegion.id,
        });
        const result = await app.graphql.mutate(
          graphql(`
            mutation updateProject($id: ID!) {
              project: transitionProject(
                # updating to this step assigns a dept id
                input: { project: $id, bypassTo: PendingFinanceConfirmation }
              ) {
                departmentId {
                  value
                }
              }
            }
          `),
          {
            id: project.id,
          },
        );
        return result.project;
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
});
