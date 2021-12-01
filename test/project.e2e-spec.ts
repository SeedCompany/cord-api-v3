import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { intersection, times } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  generateId,
  ID,
  isIdLike,
  NotFoundException,
  Order,
  PaginatedListType,
  Sensitivity,
} from '../src/common';
import { Powers, Role } from '../src/components/authorization';
import { BudgetStatus } from '../src/components/budget/dto';
import { FieldRegion } from '../src/components/field-region';
import { FieldZone } from '../src/components/field-zone';
import { Location } from '../src/components/location';
import { PartnerType } from '../src/components/partner';
import { CreatePartnership } from '../src/components/partnership';
import {
  CreateProject,
  Project,
  ProjectListInput,
  ProjectStep,
  ProjectType,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
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
  expectNotFound,
  fragments,
  getUserFromSession,
  Raw,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

const deleteProject =
  (app: TestApp, asAdmin = true) =>
  async (id: ID | string | { id: ID | string }) => {
    const doDelete = async () => {
      await app.graphql.mutate(
        gql`
          mutation DeleteProject($id: ID!) {
            deleteProject(id: $id) {
              __typename
            }
          }
        `,
        {
          id: isIdLike(id) || typeof id === 'string' ? id : id.id,
        }
      );
    };
    asAdmin ? await runAsAdmin(app, doDelete) : await doDelete();
  };

const listProjects = async (
  app: TestApp,
  input?: Partial<ProjectListInput>
) => {
  const { projects } = await app.graphql.query(
    gql`
      query ProjectList($input: ProjectListInput) {
        projects(input: $input) {
          items {
            ...project
          }
          hasMore
          total
        }
      }
      ${fragments.project}
    `,
    { input }
  );
  return projects as PaginatedListType<Raw<Project>>;
};

describe('Project e2e', () => {
  let app: TestApp;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  let director: User;
  let fieldZone: FieldZone;
  let fieldRegion: FieldRegion;
  let location: Location;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    director = await registerUserWithPower(
      app,
      [
        Powers.CreateProject,
        Powers.DeleteProject,
        Powers.CreateLanguage,
        Powers.CreateOrganization,
        Powers.CreatePartnership,
        Powers.CreateLanguageEngagement,
        Powers.CreateEthnologueLanguage,
        Powers.GrantRole,
      ],
      {
        roles: [Role.ProjectManager],
      }
    );
    fieldZone = await createZone(app, { directorId: director.id });
    fieldRegion = await createRegion(app, {
      directorId: director.id,
      fieldZoneId: fieldZone.id,
    });
    location = await createLocation(app);
    intern = await getUserFromSession(app);
    mentor = await getUserFromSession(app);
  });

  afterAll(async () => {
    //await resetDatabase(db);
    await app.close();
  });

  it('should have unique name', async () => {
    const name = faker.random.word() + ' testProject';
    await createProject(app, { name });
    await expect(createProject(app, { name })).rejects.toThrowError(
      new DuplicateException(
        `project.name`,
        `Project with this name already exists`
      )
    );
  });

  it('create & read project by id', async () => {
    const project = await createProject(app);

    const result = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );

    const actual: Project = result.project;
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
      project.estimatedSubmission.value
    );
    expect(actual.presetInventory.value).toBe(project.presetInventory.value);
  });

  it('create project with required fields', async () => {
    const project: CreateProject = {
      name: faker.datatype.uuid(),
      type: ProjectType.Translation,
      fieldRegionId: (await createRegion(app)).id,
    };

    const result = await app.graphql.mutate(
      gql`
        mutation createProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project,
        },
      }
    );
    const folders = [
      { name: 'Approval Documents' },
      { name: 'Consultant Reports' },
      { name: 'Field Correspondence' },
      { name: 'Photos' },
    ];

    const actual: Project & {
      engagements: { canRead: boolean; canCreate: boolean };
      partnerships: { canRead: boolean; canCreate: boolean };
      team: { canRead: boolean; canCreate: boolean };
    } = result.createProject.project;
    const projectFiles =
      result.createProject.project.rootDirectory.value.children.items;
    expect(projectFiles).toEqual(folders);
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
  });

  it('should throw error if the location id is not valid', async () => {
    await expect(
      createProject(app, {
        name: faker.datatype.uuid(),
        type: ProjectType.Translation,
        fieldRegionId: 'invalid-location-id' as ID,
      })
    ).rejects.toThrowError(
      new NotFoundException('Field region not found', 'project.fieldRegionId')
    );
  });

  it('create & read project with budget and field region by id', async () => {
    const proj: CreateProject = {
      name: faker.datatype.uuid(),
      type: ProjectType.Translation,
      fieldRegionId: fieldRegion.id,
    };

    const res = await app.graphql.mutate(
      gql`
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
        ${fragments.project}
        ${fragments.budget}
      `,
      {
        input: {
          project: proj,
        },
      }
    );
    const project = res.createProject.project;

    const result = await app.graphql.query(
      gql`
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
        ${fragments.project}
        ${fragments.budget}
      `,
      {
        id: project.id,
      }
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.type).toBe(project.type);
    expect(actual.budget.value.id).toBe(project.budget.value.id);
    expect(actual.fieldRegion.value.name.value).toBe(
      project.fieldRegion.value.name.value
    );
  });

  it('update project', async () => {
    const project = await createProject(app);
    const namenew = faker.random.word() + ' Project';

    const result = await app.graphql.query(
      gql`
        mutation updateProject($id: ID!, $name: String!) {
          updateProject(input: { project: { id: $id, name: $name } }) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
        name: namenew,
      }
    );

    expect(result.updateProject.project.id).toBe(project.id);
    expect(result.updateProject.project.name.value).toBe(namenew);
  });

  it.skip('delete project', async () => {
    const project = await createProject(app);
    expect(project.id).toBeTruthy();

    await deleteProject(app, false)(project.id);

    await expectNotFound(
      app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              ...project
            }
          }
          ${fragments.project}
        `,
        {
          id: project.id,
        }
      )
    );
  });

  it.skip('List of projects sorted by name to be alphabetical', async () => {
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

    const created = await Promise.all(
      unsorted.map((name) =>
        createProject(app, {
          name,
          type: ProjectType.Translation,
        })
      )
    );

    // only be concerned with projects listed here,
    // ignore other ones that have slipped in from other tests
    const filterNames = (list: PaginatedListType<Raw<Project>>) =>
      intersection(
        list.items.map((p) => p.name.value),
        unsorted
      );

    try {
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
    } finally {
      //delete all projects that Tammy has access to
      //await Promise.all(created.map(deleteProject(app)));
    }
  });

  it('List view of projects', async () => {
    // create 2 projects
    const numProjects = 2;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
          })
      )
    );

    const { projects } = await app.graphql.query(
      gql`
        query projects($type: ProjectType!) {
          projects(input: { filter: { type: $type } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `,
      {
        type,
      }
    );
    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);

    //delete all projects
    //await Promise.all(projects.items.map(deleteProject(app)));
  });

  it('List of projects sorted by Sensitivity', async () => {
    //Create three intern projects of different sensitivities
    await createProject(app, {
      name: 'High Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.High,
    });

    await createProject(app, {
      name: 'Low Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.Low,
    });

    await createProject(app, {
      name: 'Med Sensitivity Proj ' + (await generateId()),
      type: ProjectType.Internship,
      sensitivity: Sensitivity.Medium,
    });

    // Create two translation projects, one without language engagements and
    // one with 1 med and 1 low sensitivity eng translation project without engagements
    await createProject(app);

    //with engagements, low and med sensitivity, project should eval to med
    const translationProjectWithEngagements = await createProject(app);

    const medSensitivityLanguage = await createLanguage(app, {
      sensitivity: Sensitivity.Medium,
    });
    const lowSensitivityLanguage = await createLanguage(app, {
      sensitivity: Sensitivity.Low,
    });

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
        gql`
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
        `,
        {
          input: {
            sort: 'sensitivity',
            order,
          },
        }
      );
    const getSortedSensitivities = (
      projects: PaginatedListType<Raw<Project>>
    ) => projects.items.map((project) => project.sensitivity);

    const { projects: ascendingProjects } = await getSensitivitySortedProjects(
      'ASC'
    );

    expect(ascendingProjects.items.length).toBeGreaterThanOrEqual(5);

    expect(getSortedSensitivities(ascendingProjects)).toEqual([
      Sensitivity.Low,
      Sensitivity.Medium,
      Sensitivity.Medium,
      Sensitivity.High,
      Sensitivity.High,
    ]);

    const { projects: descendingProjects } = await getSensitivitySortedProjects(
      'DESC'
    );

    expect(getSortedSensitivities(descendingProjects)).toEqual([
      Sensitivity.High,
      Sensitivity.High,
      Sensitivity.Medium,
      Sensitivity.Medium,
      Sensitivity.Low,
    ]);
  });

  it('List view of my projects', async () => {
    const numProjects = 2;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
          })
      )
    );

    const { projects } = await app.graphql.query(
      gql`
        query projects {
          projects(input: { filter: { mine: true } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `
    );

    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);
    //delete all projects
    //await Promise.all(projects.items.map(deleteProject(app)));
  });

  it('List view of pinned/unpinned projects', async () => {
    const numProjects = 2;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
          })
      )
    );
    const project = await createProject(app);
    await createPin(app, project.id, true);

    // filter pinned projects
    const { projects: pinnedProjects } = await app.graphql.query(
      gql`
        query projects {
          projects(input: { filter: { pinned: true } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `
    );

    expect(pinnedProjects.items.length).toBe(1);
    expect(pinnedProjects.items[0].id).toBe(project.id);

    // filter unpinned projects
    const { projects: unpinnedProjects } = await app.graphql.query(
      gql`
        query projects {
          projects(input: { filter: { pinned: false } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `
    );

    expect(unpinnedProjects.items.length).toBeGreaterThanOrEqual(numProjects);
    // pinned project should be excluded
    const result = unpinnedProjects.items.find(
      ({ id }: Partial<Project>) => id === project.id
    );
    expect(result).toBeUndefined();
  });

  it('List view of presetInventory projects', async () => {
    const numProjects = 2;
    const type = ProjectType.Translation;
    await Promise.all(
      times(numProjects).map(
        async () =>
          await createProject(app, {
            type,
            presetInventory: true,
          })
      )
    );

    const { projects } = await app.graphql.query(
      gql`
        query projects {
          projects(input: { filter: { presetInventory: true } }) {
            items {
              ...project
            }
            hasMore
            total
          }
        }
        ${fragments.project}
      `
    );

    expect(projects.items.length).toBeGreaterThanOrEqual(numProjects);
    //delete all projects
    //await Promise.all(projects.items.map(deleteProject(app)));
  });

  it('Project engagement and sensitivity connected to language engagements', async () => {
    // create 1 engagements in a project
    const numEngagements = 1;
    const project = await createProject(app);
    const language = await createLanguage(app, {
      sensitivity: Sensitivity.Medium,
    });
    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

    const queryProject = await app.graphql.query(
      gql`
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
        ${fragments.project},
        ${fragments.languageEngagement}
      `,
      {
        id: project.id,
      }
    );
    expect(
      queryProject.project.engagements.items.length
    ).toBeGreaterThanOrEqual(numEngagements);

    expect(queryProject.project.sensitivity).toEqual(language.sensitivity);
  });

  it('List view of internship engagement', async () => {
    //create 1 engagements in a project
    const numEngagements = 1;
    const type = ProjectType.Internship;

    const project = await createProject(app, { type });

    await createInternshipEngagement(app, {
      mentorId: mentor.id,
      projectId: project.id,
      internId: intern.id,
      countryOfOriginId: location.id,
    });
    const queryProject = await app.graphql.query(
      gql`
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
        ${fragments.project},
        ${fragments.internshipEngagement}
      `,
      {
        id: project.id,
      }
    );
    expect(
      queryProject.project.engagements.items.length
    ).toBeGreaterThanOrEqual(numEngagements);
  });

  it('DB constraint for project.name uniqueness', async () => {
    const projName = 'Fix the world ' + DateTime.local().toString();
    const project = await createProject(app, { name: projName });
    await expect(createProject(app, { name: projName })).rejects.toThrowError(
      new DuplicateException(
        `project.name`,
        `Project with this name already exists`
      )
    );

    //clean up
    //await deleteProject(app)(project);
  });

  it('List view of project members by projectId', async () => {
    //create 2 Project member
    const numProjectMembers = 2;
    const project = await createProject(app);
    const projectId = project.id;
    const userForList = await createPerson(app, { roles: [Role.Consultant] });
    const userId = userForList.id;
    const userForList2 = await createPerson(app, { roles: [Role.Consultant] });
    const userId2 = userForList2.id;
    const memberIds: ID[] = [userId, userId2];

    await Promise.all(
      times(numProjectMembers, async (index) => {
        await createProjectMember(app, {
          userId: memberIds[index],
          projectId,
          roles: [Role.Consultant],
        });
      })
    );

    const queryProject = await app.graphql.query(
      gql`
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
        ${fragments.project},
        ${fragments.projectMember}
      `,
      {
        id: project.id,
      }
    );

    // Remember the project Owner is also a team member so that should be +1
    expect(queryProject.project.team.items.length).toBe(numProjectMembers + 1);
    expect(queryProject.project.team.total).toBe(numProjectMembers + 1);
  });

  it('List view of partnerships by projectId', async () => {
    //create 2 partnerships in a project
    const numPartnerships = 2;
    const type = ProjectType.Translation;
    const project = await createProject(app, { type });

    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          projectId: project.id,
        })
      )
    );

    const queryProject = await app.graphql.query(
      gql`
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
        ${fragments.project},
        ${fragments.partnership}
      `,
      {
        id: project.id,
      }
    );

    expect(
      queryProject.project.partnerships.items.length
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
      });

      for (const next of stepsFromEarlyConversationToBeforeActive) {
        await changeProjectStep(app, project.id, next);
      }

      const result = await app.graphql.mutate(
        gql`
          mutation updateProject($id: ID!, $step: ProjectStep!) {
            updateProject(input: { project: { id: $id, step: $step } }) {
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
        `,
        {
          id: project.id,
          // Ensure the result from the change to Active returns the correct budget status
          step: ProjectStep.Active,
        }
      );

      expect(result?.updateProject.project.budget.value.status).toBe(
        BudgetStatus.Current
      );
      expect(result?.updateProject.project.departmentId.value).toContain(
        fundingAccount.accountNumber.value
      );
      // Ensure the initialMouEnd is updated to mouEnd value
      expect(result?.updateProject.project.initialMouEnd.value).toBe(
        project.mouEnd.value
      );
    });
  });

  // #727 create without mouStart, mouEnd, estimatedSubmission
  it('can create without mouStart, mouEnd and estimatedSubmission', async () => {
    const project: CreateProject = {
      name: faker.datatype.uuid(),
      type: ProjectType.Translation,
      fieldRegionId: fieldRegion.id,
    };

    const { createProject } = await app.graphql.mutate(
      gql`
        mutation createProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project,
        },
      }
    );
    expect(createProject.project.id).toBeDefined();
  });

  it('can create without mouStart, if mouEnd is defined', async () => {
    const project: CreateProject = {
      name: faker.datatype.uuid(),
      type: ProjectType.Translation,
      mouEnd: CalendarDate.fromISO('1992-11-01'),
      estimatedSubmission: CalendarDate.fromISO('1993-11-01'),
      fieldRegionId: fieldRegion.id,
    };

    const { createProject } = await app.graphql.mutate(
      gql`
        mutation createProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project,
        },
      }
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
      name: faker.datatype.uuid() + ' project',
      mouStart: undefined,
      mouEnd: undefined,
    });

    const partnership: CreatePartnership = {
      projectId: proj.id,
      partnerId: (await createPartner(app, { organizationId: org.id })).id,
      types: [PartnerType.Funding],
    };

    // Create Partnership with Funding type
    await app.graphql.mutate(
      gql`
        mutation createPartnership($input: CreatePartnershipInput!) {
          createPartnership(input: $input) {
            partnership {
              ...partnership
            }
          }
        }
        ${fragments.partnership}
      `,
      {
        input: {
          partnership,
        },
      }
    );

    // Update Project with mou dates
    const result = await app.graphql.mutate(
      gql`
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
        ${fragments.project}
      `,
      {
        id: proj.id,
        mouStart: CalendarDate.fromISO('2020-08-23'),
        mouEnd: CalendarDate.fromISO('2021-08-22'),
      }
    );

    const actual = result.updateProject.project;
    expect(actual.id).toBe(proj.id);
    expect(actual.budget.value.records.length).toBe(2);
  });

  /**
   * After creating a partnership, should be able to query project and get organization
   */
  it('after creating a partnership, should be able to query project and get organization', async () => {
    const org = await createOrganization(app);
    const project = await createProject(app, {
      name: faker.datatype.uuid() + ' project',
    });
    const partnership: CreatePartnership = {
      projectId: project.id,
      partnerId: (await createPartner(app, { organizationId: org.id })).id,
      types: [PartnerType.Funding],
    };

    await app.graphql.mutate(
      gql`
        mutation createPartnership($input: CreatePartnershipInput!) {
          createPartnership(input: $input) {
            partnership {
              ...partnership
            }
          }
        }
        ${fragments.partnership}
      `,
      {
        input: {
          partnership,
        },
      }
    );

    const projectQueryResult = await app.graphql.query(
      gql`
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
      `,
      {
        id: project.id,
      }
    );
    const firstBudgetRecordOrganizationId =
      projectQueryResult.project.budget.value.records[0].organization.value.id;
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
        });
        const updatedProject = await app.graphql.mutate(
          gql`
            mutation updateProject($id: ID!, $step: ProjectStep!) {
              updateProject(input: { project: { id: $id, step: $step } }) {
                project {
                  departmentId {
                    value
                  }
                }
              }
            }
          `,
          {
            id: project.id,
            // updating to this step assigns a dept id
            step: ProjectStep.PendingFinanceConfirmation,
          }
        );
        return updatedProject.updateProject.project;
      };
      const projects = await Promise.all(
        ['1', '2'].map(async (i) => {
          return await createAndUpdateProject(i);
        })
      );
      const [project1, project2] = projects;

      expect(project1.departmentId.value).not.toBe(project2.departmentId.value);
    });
  });
});
