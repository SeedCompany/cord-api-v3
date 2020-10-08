import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { orderBy, times } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  Sensitivity,
  ServerException,
} from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { BudgetStatus } from '../src/components/budget/dto';
import { FieldRegion } from '../src/components/field-region';
import { FieldZone } from '../src/components/field-zone';
import { Location } from '../src/components/location';
import { PartnerType } from '../src/components/partner';
import { CreatePartnership } from '../src/components/partnership';
import {
  CreateProject,
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  Role,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createInternshipEngagement,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createPartner,
  createPartnership,
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  createZone,
  expectNotFound,
  fragments,
  getUserFromSession,
  login,
  registerUser,
  registerUserWithPower,
  TestApp,
} from './utility';

describe('Project e2e', () => {
  let app: TestApp;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  let director: User;
  let fieldZone: FieldZone;
  let fieldRegion: FieldRegion;
  let location: Location;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await registerUser(app);
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

  it('should have project step', async () => {
    const project = await createProject(app);
    expect(project.step.value).toBe(ProjectStep.PendingConceptApproval);
  });

  it('should have project status', async () => {
    const project = await createProject(app);
    expect(project.status).toBe(ProjectStatus.Pending);
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
  });

  it('create project with required fields', async () => {
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const project: CreateProject = {
      name: faker.random.uuid(),
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

    const actual: Project & {
      engagements: { canRead: boolean; canCreate: boolean };
      partnerships: { canRead: boolean; canCreate: boolean };
      team: { canRead: boolean; canCreate: boolean };
    } = result.createProject.project;
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
        name: faker.random.uuid(),
        type: ProjectType.Translation,
        fieldRegionId: 'invalid-location-id',
      })
    ).rejects.toThrowError(new ServerException('Could not create project'));
  });

  it('create & read project with budget and field region by id', async () => {
    const proj: CreateProject = {
      name: faker.random.uuid(),
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
    const result = await app.graphql.mutate(
      gql`
        mutation deleteProject($id: ID!) {
          deleteProject(id: $id)
        }
      `,
      {
        id: project.id,
      }
    );

    const actual: boolean | undefined = result.deleteProject;
    expect(actual).toBeTruthy();
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

  it('List of projects sorted by name to be alphabetical, ignoring case sensitivity. Order: ASCENDING', async () => {
    await registerUser(app, { displayFirstName: 'Tammy' });
    //Create three projects with mixed cases.
    await createProject(app, {
      name: 'a project 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    await createProject(app, {
      name: 'Another project 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    await createProject(app, {
      name: 'Big project 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    await createProject(app, {
      name: 'big project also 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    const sortBy = 'name';
    const ascOrder = 'ASC';
    const { projects } = await app.graphql.query(
      gql`
        query projects($input: ProjectListInput!) {
          projects(input: $input) {
            hasMore
            total
            items {
              id
              name {
                value
              }
            }
          }
        }
      `,
      {
        input: {
          sort: sortBy,
          order: ascOrder,
          filter: {
            mine: true,
          },
        },
      }
    );
    const items = projects.items;
    const sorted = orderBy(items, (proj) => proj.name.value.toLowerCase(), [
      'asc',
    ]);
    expect(sorted).toEqual(items);
    //delete all projects that Tammy has access to
    await Promise.all(
      projects.items.map(async (item: { id: any }) => {
        return await app.graphql.mutate(
          gql`
            mutation deleteProject($id: ID!) {
              deleteProject(id: $id)
            }
          `,
          {
            id: item.id,
          }
        );
      })
    );
  });

  it('List of projects sorted by name to be alphabetical, ignoring case sensitivity. Order: DESCENDING', async () => {
    await registerUser(app, { displayFirstName: 'Tammy' });
    //Create three projects, each beginning with lower or upper-cases.
    await createProject(app, {
      name: 'a project 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    await createProject(app, {
      name: 'Another project 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    await createProject(app, {
      name: 'Big project 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    await createProject(app, {
      name: 'big project also 2' + faker.random.uuid(),
      type: ProjectType.Translation,
    });
    const sortBy = 'name';
    const ascOrder = 'DESC';
    const { projects } = await app.graphql.query(
      gql`
        query projects($input: ProjectListInput!) {
          projects(input: $input) {
            hasMore
            total
            items {
              id
              name {
                value
              }
            }
          }
        }
      `,
      {
        input: {
          sort: sortBy,
          order: ascOrder,
          filter: {
            mine: true,
          },
        },
      }
    );
    const items = projects.items;
    const sorted = orderBy(items, (proj) => proj.name.value.toLowerCase(), [
      'desc',
    ]);
    expect(sorted).toEqual(items);
    //delete all projects
    await Promise.all(
      projects.items.map(async (item: { id: any }) => {
        return await app.graphql.mutate(
          gql`
            mutation deleteProject($id: ID!) {
              deleteProject(id: $id)
            }
          `,
          {
            id: item.id,
          }
        );
      })
    );
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
    await Promise.all(
      projects.items.map(async (item: { id: any }) => {
        return await app.graphql.mutate(
          gql`
            mutation deleteProject($id: ID!) {
              deleteProject(id: $id)
            }
          `,
          {
            id: item.id,
          }
        );
      })
    );
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
    await Promise.all(
      projects.items.map(async (item: { id: any }) => {
        return await app.graphql.mutate(
          gql`
            mutation deleteProject($id: ID!) {
              deleteProject(id: $id)
            }
          `,
          {
            id: item.id,
          }
        );
      })
    );
  });

  it('Project engagement and sensitivity connected to language engagements', async () => {
    // create 1 engagementsin a project
    const numEngagements = 1;
    //const type = ProjectType.Translation;

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

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

  it.skip('List view of internship engagement', async () => {
    //create 1 engagements in a project
    const numEngagements = 1;
    const type = ProjectType.Internship;

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

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
    await app.graphql.mutate(
      gql`
        mutation deleteProject($id: ID!) {
          deleteProject(id: $id)
        }
      `,
      {
        id: project.id,
      }
    );
  });

  it('List view of project members by projectId', async () => {
    //create 2 Project member
    const numProjectMembers = 2;
    const project = await createProject(app);
    const projectId = project.id;
    const password = faker.internet.password();
    const password2 = faker.internet.password();
    const userForList = await registerUser(app, { password });
    const userId = userForList.id;
    const userForList2 = await registerUser(app, { password: password2 });
    const userId2 = userForList2.id;
    const memberIds: string[] = [userId, userId2];

    await login(app, { email: userForList.email.value, password });

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
    expect(queryProject.project.team.items.length).toBe(numProjectMembers);
    expect(queryProject.project.team.total).toBe(numProjectMembers);
  });

  it('List view of partnerships by projectId', async () => {
    await registerUserWithPower(app, Powers.CreateOrganization);
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

  it('Should have default status as Pending for first budget with project creation', async () => {
    const type = ProjectType.Translation;
    const project = await createProject(app, { type });

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            budget {
              value {
                id
                status
              }
              canRead
              canEdit
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );
    expect(queryProject.project.budget.value.status).toBe('Pending');
  });

  it('Should have a current budget when made active', async () => {
    const project = await createProject(app);

    const result = await app.graphql.mutate(
      gql`
        mutation updateProject($id: ID!) {
          updateProject(input: { project: { id: $id, step: Active } }) {
            project {
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
      }
    );

    expect(result.updateProject.project.budget.value.status).toBe(
      BudgetStatus.Current
    );
  });

  // #727 create without mouStart, mouEnd, estimatedSubmission
  it('can create without mouStart, mouEnd and estimatedSubmission', async () => {
    const project: CreateProject = {
      name: faker.random.uuid(),
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
      name: faker.random.uuid(),
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
    const proj = await createProject(app, {
      name: faker.random.uuid() + ' project',
      mouStart: undefined,
      mouEnd: undefined,
    });

    const partnership: CreatePartnership = {
      projectId: proj.id,
      partnerId: (await createPartner(app, { organizationId: 'seedcompanyid' }))
        .id,
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
    const defaultOrganizationId = 'seedcompanyid';
    const project = await createProject(app, {
      name: faker.random.uuid() + ' project',
    });
    const partnership: CreatePartnership = {
      projectId: project.id,
      partnerId: (
        await createPartner(app, { organizationId: defaultOrganizationId })
      ).id,
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
    expect(firstBudgetRecordOrganizationId).toBe(defaultOrganizationId);
  });
});
