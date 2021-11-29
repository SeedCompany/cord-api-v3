import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { some } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { generateId, ID, InputException } from '../src/common';
import { Powers, Role } from '../src/components/authorization';
import {
  CreateInternshipEngagement,
  EngagementStatus,
  InternshipEngagement,
  InternshipPosition,
  LanguageEngagement,
} from '../src/components/engagement';
import { Language } from '../src/components/language';
import { Location } from '../src/components/location';
import { ProductMethodology } from '../src/components/product';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectStepTransition,
  ProjectType,
} from '../src/components/project';
import { User } from '../src/components/user';
import {
  createFundingAccount,
  createInternshipEngagement,
  createInternshipEngagementWithMinimumValues,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createPerson,
  createProject,
  createSession,
  createTestApp,
  expectNotFound,
  fragments,
  getUserFromSession,
  Raw,
  registerUser,
  registerUserWithPower,
  requestFileUpload,
  runAsAdmin,
  TestApp,
  TestUser,
  uploadFileContents,
} from './utility';
import { createProduct } from './utility/create-product';
import { resetDatabase } from './utility/reset-database';
import {
  changeInternshipEngagementStatus,
  transitionEngagementToActive,
} from './utility/transition-engagement';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
  stepsFromEarlyConversationToBeforeCompleted,
  stepsFromEarlyConversationToBeforeTerminated,
} from './utility/transition-project';

describe('Engagement e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;
  let internshipProject: Raw<Project>;
  let language: Language;
  let location: Location;
  let user: TestUser;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);

    await createSession(app);

    user = await registerUserWithPower(
      app,
      [Powers.CreateLanguage, Powers.CreateEthnologueLanguage],
      {
        roles: [
          Role.ProjectManager,
          Role.FieldOperationsDirector,
          Role.Consultant,
        ],
      }
    );
    language = await createLanguage(app);
    location = await createLocation(app);
    intern = await getUserFromSession(app);
    mentor = await getUserFromSession(app);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('creates a language engagement', async () => {
    project = await createProject(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
      status: EngagementStatus.InDevelopment,
    });
    expect(languageEngagement.modifiedAt).toBeDefined();
    expect(languageEngagement.id).toBeDefined();
    const difference = Interval.fromDateTimes(
      DateTime.fromISO(languageEngagement.modifiedAt.toString()),
      DateTime.local()
    )
      .toDuration()
      .toFormat('S');
    expect(parseInt(difference)).toBeGreaterThan(0);
    expect(languageEngagement.status.value).toBe(
      EngagementStatus.InDevelopment
    );
  });

  it('create a language engagement with only required fields', async () => {
    project = await createProject(app);
    const languageEngagement = {
      languageId: language.id,
      projectId: project.id,
    };
    const result = await app.graphql.mutate(
      gql`
        mutation createLanguageEngagement(
          $input: CreateLanguageEngagementInput!
        ) {
          createLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: languageEngagement,
        },
      }
    );

    const actual: LanguageEngagement =
      result.createLanguageEngagement.engagement;
    expect(actual.id).toBeDefined();
    expect(actual.firstScripture.value).toBeNull();
    expect(actual.lukePartnership.value).toBeNull();
    expect(actual.sentPrintingDate.value).toBeNull();
    expect(actual.completeDate.value).toBeNull();
    expect(actual.disbursementCompleteDate.value).toBeNull();
    expect(actual.startDate.value).toBe(project.mouStart.value); // bump
    expect(actual.endDate.value).toBe(project.mouEnd.value);
    expect(actual.lastSuspendedAt.value).toBeNull();
    expect(actual.lastReactivatedAt.value).toBeNull();
    expect(actual.paratextRegistryId.value).toBeNull();
  });

  it('creates a internship engagement', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const internEngagement = await createInternshipEngagement(app, {
      projectId: internshipProject.id,
      countryOfOriginId: location.id,
      internId: intern.id,
      mentorId: mentor.id,
    });

    expect(internEngagement.id).toBeDefined();
    const difference = Interval.fromDateTimes(
      DateTime.fromISO(internEngagement.modifiedAt.toString()),
      DateTime.local()
    )
      .toDuration()
      .toFormat('S');
    expect(parseInt(difference)).toBeGreaterThan(0);
    expect(internEngagement.status.value).toBe(EngagementStatus.InDevelopment);
  });

  it('create a internship engagement with only requited fields', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const internshipEngagement: CreateInternshipEngagement = {
      projectId: internshipProject.id,
      internId: user.id,
    };

    const result = await app.graphql.mutate(
      gql`
        mutation createInternshipEngagement(
          $input: CreateInternshipEngagementInput!
        ) {
          createInternshipEngagement(input: $input) {
            engagement {
              ...internshipEngagement
            }
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        input: {
          engagement: internshipEngagement,
        },
      }
    );

    const actual: InternshipEngagement =
      result.createInternshipEngagement.engagement;
    expect(actual.id).toBeDefined();
    expect(actual.countryOfOrigin.value).toBeNull();
    expect(actual.mentor.value).toBeNull();
    expect(actual.position.value).toBeNull();
    expect(actual.completeDate.value).toBeNull();
    expect(actual.disbursementCompleteDate.value).toBeNull();
    expect(actual.startDate.value).toBe(internshipProject.mouStart.value);
    expect(actual.endDate.value).toBe(internshipProject.mouEnd.value);
    expect(actual.lastSuspendedAt.value).toBeNull();
    expect(actual.lastReactivatedAt.value).toBeNull();
  });

  it('reads a an language engagement by id', async () => {
    project = await createProject(app);
    const upload = await requestFileUpload(app);
    const fakeFile = await uploadFileContents(app, upload.url);

    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
      pnp: {
        uploadId: upload.id,
        name: fakeFile.name,
      },
    });

    const { engagement: actual } = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...languageEngagement
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        id: languageEngagement.id,
      }
    );

    expect(actual.id).toBe(languageEngagement.id);
    expect(actual.language).toMatchObject(languageEngagement.language);
    expect(actual.firstScripture).toMatchObject(
      languageEngagement.firstScripture
    );
    expect(actual.lukePartnership).toMatchObject(
      languageEngagement.lukePartnership
    );
    expect(actual.ceremony).toBeDefined();
    expect(actual.completeDate).toMatchObject(languageEngagement.completeDate);
    expect(actual.disbursementCompleteDate).toMatchObject(
      languageEngagement.disbursementCompleteDate
    );
    expect(actual.startDate).toMatchObject(languageEngagement.startDate);
    expect(actual.endDate).toMatchObject(languageEngagement.endDate);
    expect(actual.modifiedAt).toBe(languageEngagement.modifiedAt);
    expect(actual.paratextRegistryId).toMatchObject(
      languageEngagement.paratextRegistryId
    );
    expect(actual.pnp).toMatchObject(languageEngagement.pnp);
  });

  it('reads an internship engagement by id', async () => {
    const upload = await requestFileUpload(app);
    const fakeFile = await uploadFileContents(app, upload.url);
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });

    const internshipEngagement = await createInternshipEngagement(app, {
      mentorId: mentor.id,
      projectId: internshipProject.id,
      countryOfOriginId: location.id,
      internId: intern.id,
      growthPlan: {
        uploadId: upload.id,
        name: fakeFile.name,
      },
    });

    const { engagement: actual } = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...internshipEngagement
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        id: internshipEngagement.id,
      }
    );

    expect(actual.id).toBe(internshipEngagement.id);
    expect(actual.intern).toMatchObject(internshipEngagement.intern);
    expect(actual.mentor).toMatchObject(internshipEngagement.mentor);
    expect(actual.countryOfOrigin).toMatchObject(
      internshipEngagement.countryOfOrigin
    );
    expect(actual.methodologies).toMatchObject(
      internshipEngagement.methodologies
    );
    expect(actual.position).toMatchObject(internshipEngagement.position);
    expect(actual.ceremony).toBeDefined();
    expect(actual.completeDate).toMatchObject(
      internshipEngagement.completeDate
    );
    expect(actual.disbursementCompleteDate).toMatchObject(
      internshipEngagement.disbursementCompleteDate
    );
    expect(actual.startDate).toMatchObject(internshipEngagement.startDate);
    expect(actual.endDate).toMatchObject(internshipEngagement.endDate);
    expect(actual.growthPlan).toMatchObject(internshipEngagement.growthPlan);
  });

  it('update language engagement', async () => {
    project = await createProject(app);
    const languageEngagement = await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
      status: EngagementStatus.InDevelopment,
    });

    const updateFirstScripture = false;
    const updateLukePartnership = false;
    const updateParatextRegistryId = faker.random.word();

    const result = await app.graphql.mutate(
      gql`
        mutation updateLanguageEngagement(
          $input: UpdateLanguageEngagementInput!
        ) {
          updateLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            id: languageEngagement.id,
            firstScripture: updateFirstScripture,
            lukePartnership: updateLukePartnership,
            paratextRegistryId: updateParatextRegistryId,
          },
        },
      }
    );
    const updated = result.updateLanguageEngagement.engagement;
    expect(updated).toBeTruthy();
    expect(DateTime.fromISO(updated.modifiedAt).toMillis()).toBeGreaterThan(
      DateTime.fromISO(languageEngagement.modifiedAt).toMillis()
    );
    expect(updated.id).toBe(languageEngagement.id);
    expect(updated.firstScripture.value).toBe(updateFirstScripture);
    expect(updated.lukePartnership.value).toBe(updateLukePartnership);
    expect(updated.paratextRegistryId.value).toBe(updateParatextRegistryId);
    expect(updated.status.value).toBe(EngagementStatus.InDevelopment);
  });

  it('updates internship engagement', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const mentor = await createPerson(app);
    const internshipEngagement =
      await createInternshipEngagementWithMinimumValues(app, {
        projectId: internshipProject.id,
        internId: intern.id,
      });
    const updatePosition = InternshipPosition.LanguageProgramManager;
    const updateMethodologies = [
      ProductMethodology.Paratext,
      ProductMethodology.StoryTogether,
    ];

    const result = await app.graphql.mutate(
      gql`
        mutation updateInternshipEngagement(
          $input: UpdateInternshipEngagementInput!
        ) {
          updateInternshipEngagement(input: $input) {
            engagement {
              ...internshipEngagement
              modifiedAt
            }
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        input: {
          engagement: {
            id: internshipEngagement.id,
            mentorId: mentor.id,
            countryOfOriginId: location.id,
            position: updatePosition,
            methodologies: updateMethodologies,
          },
        },
      }
    );

    const updated = result.updateInternshipEngagement.engagement;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(internshipEngagement.id);
    expect(updated.mentor.value.id).toBe(mentor.id);
    expect(updated.countryOfOrigin.value.id).toBe(location.id);
    expect(updated.position.value).toBe(updatePosition);
    expect(updated.methodologies.value).toEqual(
      expect.arrayContaining(updateMethodologies)
    );

    const difference = Interval.fromDateTimes(
      DateTime.fromISO(internshipEngagement.modifiedAt.toString()),
      DateTime.fromISO(updated.modifiedAt)
    )
      .toDuration()
      .toFormat('S');
    expect(parseInt(difference)).toBeGreaterThan(0);
  });

  it.skip('deletes engagement', async () => {
    project = await createProject(app);
    const languageEngagement = await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteEngagement($id: ID!) {
          deleteEngagement(id: $id) {
            __typename
          }
        }
      `,
      {
        id: languageEngagement.id,
      }
    );

    const actual: boolean | undefined = result.deleteEngagement;
    expect(actual).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
        gql`
          query engagement($id: ID!) {
            engagement(id: $id) {
              ...languageEngagement
            }
          }
          ${fragments.languageEngagement}
        `,
        {
          id: languageEngagement.id,
        }
      )
    );
  });

  it('returns the correct products in language engagement', async () => {
    project = await createProject(app);
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const product1 = await createProduct(app, {
      engagementId: languageEngagement.id,
    });
    const product2 = await createProduct(app, {
      engagementId: languageEngagement.id,
    });
    const result = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...languageEngagement
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        id: languageEngagement.id,
      }
    );
    expect(result.engagement.products.total).toEqual(2);
    expect(result.engagement.products.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: product1.id,
        }),
      ])
    );
    expect(result.engagement.products.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: product2.id,
        }),
      ])
    );
  });

  it('creates ceremony upon engagement creation', async () => {
    project = await createProject(app);
    language = await createLanguage(app);

    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const result = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...languageEngagement
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        id: languageEngagement.id,
      }
    );

    expect(result?.engagement?.ceremony?.value?.id).toBeDefined();
  });

  it('updates ceremony for language engagement', async () => {
    project = await createProject(app, { type: ProjectType.Translation });
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const languageEngagementRead = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...languageEngagement
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        id: languageEngagement.id,
      }
    );
    expect(
      languageEngagementRead?.engagement?.ceremony?.value?.id
    ).toBeDefined();

    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    const date = '2020-05-13';
    await app.graphql.mutate(
      gql`
        mutation updateCeremony($input: UpdateCeremonyInput!) {
          updateCeremony(input: $input) {
            ceremony {
              id
            }
          }
        }
      `,
      {
        input: {
          ceremony: {
            id: languageEngagementRead?.engagement?.ceremony?.value?.id,
            planned: true,
            estimatedDate: date,
          },
        },
      }
    );
    const result = await app.graphql.query(
      gql`
        query ceremony($id: ID!) {
          ceremony(id: $id) {
            id
            planned {
              value
            }
            estimatedDate {
              value
              canRead
              canEdit
            }
          }
        }
      `,
      {
        id: languageEngagementRead?.engagement?.ceremony?.value?.id,
      }
    );
    expect(result.ceremony.planned.value).toBeTruthy();
    expect(result.ceremony.estimatedDate.value).toBe(date);

    await user.login();
  });

  it('updates ceremony for internship engagement', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const ie = await createInternshipEngagement(app, {
      projectId: internshipProject.id,
      internId: intern.id,
      mentorId: mentor.id,
      countryOfOriginId: location.id,
    });

    const internshipEngagementRead = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...internshipEngagement
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        id: ie.id,
      }
    );
    expect(
      internshipEngagementRead?.engagement?.ceremony?.value?.id
    ).toBeDefined();

    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    const date = '2020-05-13';
    await app.graphql.mutate(
      gql`
        mutation updateCeremony($input: UpdateCeremonyInput!) {
          updateCeremony(input: $input) {
            ceremony {
              id
            }
          }
        }
      `,
      {
        input: {
          ceremony: {
            id: internshipEngagementRead?.engagement?.ceremony?.value?.id,
            planned: true,
            estimatedDate: date,
          },
        },
      }
    );
    const result = await app.graphql.query(
      gql`
        query ceremony($id: ID!) {
          ceremony(id: $id) {
            id
            planned {
              value
            }
            estimatedDate {
              value
              canRead
              canEdit
            }
          }
        }
      `,
      {
        id: internshipEngagementRead?.engagement?.ceremony?.value?.id,
      }
    );
    expect(result.ceremony.planned.value).toBeTruthy();
    expect(result.ceremony.estimatedDate.value).toBe(date);

    await user.login();
  });

  it.skip('delete ceremony upon engagement deletion', async () => {
    project = await createProject(app);
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const languageEngagementRead = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ...languageEngagement
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        id: languageEngagement.id,
      }
    );

    expect(
      languageEngagementRead?.engagement?.ceremony?.value?.id
    ).toBeDefined();

    const ceremonyId = languageEngagementRead?.engagement?.ceremony?.value?.id;

    await app.graphql.mutate(
      gql`
        mutation deleteEngagement($id: ID!) {
          deleteEngagement(id: $id) {
            __typename
          }
        }
      `,
      {
        id: languageEngagement.id,
      }
    );

    await expectNotFound(
      app.graphql.query(
        gql`
          query ceremony($id: ID!) {
            ceremony(id: $id) {
              ...ceremony
            }
          }
          ${fragments.ceremony}
        `,
        {
          id: ceremonyId,
        }
      )
    );
  });

  it('lists both language engagements and internship engagements', async () => {
    project = await createProject(app);
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });

    await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    await createInternshipEngagement(app, {
      projectId: internshipProject.id,
      countryOfOriginId: location.id,
      internId: intern.id,
      mentorId: mentor.id,
    });
    const { engagements } = await app.graphql.query(
      gql`
        query {
          engagements(input: { count: 7 }) {
            items {
              __typename
              id
              ... on LanguageEngagement {
                createdAt
              }
              ... on InternshipEngagement {
                createdAt
              }
            }
          }
        }
      `
    );

    expect(
      some(engagements.items, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: 'InternshipEngagement',
      })
    ).toBeTruthy();
    expect(
      some(engagements.items, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: 'LanguageEngagement',
      })
    ).toBeTruthy();
  });

  it('internship engagement creation fails and lets you know why if your ids are bad', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const invalidId = await generateId();
    await expect(
      createInternshipEngagement(app, {
        projectId: invalidId,
        countryOfOriginId: location.id,
        internId: intern.id,
        mentorId: mentor.id,
      })
    ).rejects.toThrow('Could not find project');
    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: invalidId,
        internId: intern.id,
        mentorId: mentor.id,
      })
    ).rejects.toThrow('Could not find country of origin');

    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });

    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: location.id,
        internId: invalidId,
        mentorId: mentor.id,
      })
    ).rejects.toThrow('Could not find person');

    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });

    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: location.id,
        internId: intern.id,
        mentorId: invalidId,
      })
    ).rejects.toThrow('Could not find mentor');
  });

  it('language engagement creation fails and lets you know why if your ids are bad', async () => {
    const invalidId = await generateId();
    await expect(
      createLanguageEngagement(app, {
        projectId: invalidId,
        languageId: language.id,
      })
    ).rejects.toThrow('Could not find project');
    await expect(
      createLanguageEngagement(app, {
        projectId: project.id,
        languageId: invalidId,
      })
    ).rejects.toThrow('Could not find language');
  });

  it('should return empty methodologies array even if it is null', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    // Create InternshipEngagement without methodologies
    const internshipEngagement = await createInternshipEngagement(app, {
      projectId: internshipProject.id,
      internId: intern.id,
      methodologies: [],
    });

    const { engagement: actual } = await app.graphql.query(
      gql`
      query {
        engagement(id: "${internshipEngagement.id}") {
          ... on InternshipEngagement {
            id
            methodologies {
              value
            }
          }
        }
      }
      `
    );
    expect(internshipEngagement.id).toBeDefined();
    expect(actual.methodologies).toBeDefined();
    expect(actual.methodologies.value).toMatchObject([]);
  });

  it('should throw error if Project type does not match with Engagement type', async () => {
    project = await createProject(app);
    await expect(
      createInternshipEngagement(app, {
        projectId: project.id,
      })
    ).rejects.toThrowError(
      new InputException(
        'Only Internship Engagements can be created on Internship Projects',
        'engagement.projectId'
      )
    );
  });

  it('should throw error if language engagement already exists with same project and language', async () => {
    const project = await createProject(app);
    const language = await createLanguage(app);

    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

    await expect(
      createLanguageEngagement(app, {
        projectId: project.id,
        languageId: language.id,
      })
    ).rejects.toThrowError(
      'Engagement for this project and language already exists'
    );
  });

  it('should throw error if internship engagement already exists with same project and intern', async () => {
    const project = await createProject(app, {
      type: ProjectType.Internship,
    });
    const intern = await createPerson(app);

    await createInternshipEngagement(app, {
      projectId: project.id,
      internId: intern.id,
    });

    await expect(
      createInternshipEngagement(app, {
        projectId: project.id,
        internId: intern.id,
      })
    ).rejects.toThrowError(
      'Engagement for this project and person already exists'
    );
  });

  it('can not set firstScripture=true if the language has hasExternalFirstScripture=true', async () => {
    const language = await createLanguage(app, {
      hasExternalFirstScripture: true,
    });
    await expect(
      createLanguageEngagement(app, {
        languageId: language.id,
        firstScripture: true,
      })
    ).rejects.toThrowError(
      'First scripture has already been marked as having been done externally'
    );
  });

  it('can not set firstScripture=true if it is not only engagement for the language that has firstScripture=true', async () => {
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      languageId: language.id,
      firstScripture: true,
    });
    await createLanguageEngagement(app, { languageId: language.id });
    await expect(
      createLanguageEngagement(app, {
        languageId: language.id,
        firstScripture: true,
      })
    ).rejects.toThrowError(
      'Another engagement has already been marked as having done the first scripture'
    );
  });

  it('should not enable a Project step transition if the step is FinalizingCompletion and there are Engagements with non-terminal statuses', async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const project = await createProject(app, {
      step: ProjectStep.EarlyConversations,
      primaryLocationId: location.id,
    });
    await createLanguageEngagement(app, {
      projectId: project.id,
    });

    await runAsAdmin(app, async () => {
      for (const next of stepsFromEarlyConversationToBeforeCompleted) {
        await changeProjectStep(app, project.id, next);
      }
      const projectQueryResult = await app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              id
              step {
                value
                transitions {
                  to
                  disabled
                  disabledReason
                }
              }
            }
          }
        `,
        {
          id: project.id,
        }
      );

      const toCompletedTransition =
        projectQueryResult.project.step.transitions.find(
          (t: ProjectStepTransition) => t.to === 'Completed'
        );

      expect(projectQueryResult.project.step.value).toBe(
        ProjectStep.FinalizingCompletion
      );
      expect(toCompletedTransition.disabled).toBe(true);
      expect(toCompletedTransition.disabledReason).toBe(
        'The project cannot be completed since some engagements have a non-terminal status'
      );
    });
    // can't complete a project if you're not an admin and transition is disabled because of non terminal engagements
    const updateProject = async () => {
      return await app.graphql.mutate(
        gql`
          mutation transitionProject($id: ID!, $step: ProjectStep!) {
            transitionProject(input: { id: $id, step: $step }) {
              project {
                id
                engagements {
                  items {
                    id
                    status {
                      value
                    }
                  }
                }
              }
            }
          }
        `,
        {
          id: project.id,
          step: ProjectStep.Completed,
        }
      );
    };
    await expect(updateProject).rejects.toThrow(Error);
  });

  it.each([
    [EngagementStatus.Active, stepsFromEarlyConversationToBeforeActive],
    [EngagementStatus.DidNotDevelop, []],
    [EngagementStatus.Rejected, stepsFromEarlyConversationToBeforeActive],
    [EngagementStatus.Terminated, stepsFromEarlyConversationToBeforeTerminated],
    // this only happens when an admin overrides to completed
    // this is prohibited if there are non terminal engagements
    [EngagementStatus.Completed, stepsFromEarlyConversationToBeforeCompleted],
  ])(
    'should update Engagement status to match Project step when it becomes %s',
    async (newStatus: EngagementStatus, steps: ProjectStep[] | []) => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const project = await createProject(app, {
        step: ProjectStep.EarlyConversations,
        primaryLocationId: location.id,
      });
      expect(project.status).toBe(ProjectStatus.InDevelopment);

      const engagement = await createLanguageEngagement(app, {
        projectId: project.id,
      });
      expect(engagement.status.value === EngagementStatus.InDevelopment).toBe(
        true
      );
      await runAsAdmin(app, async () => {
        for (const next of steps) {
          await changeProjectStep(app, project.id, next);
        }

        const result = await app.graphql.mutate(
          gql`
            mutation transitionProject($id: ID!, $step: ProjectStep!) {
              transitionProject(input: { id: $id, step: $step }) {
                project {
                  id
                  engagements {
                    items {
                      id
                      status {
                        value
                      }
                    }
                  }
                }
              }
            }
          `,
          {
            id: project.id,
            step: newStatus,
          }
        );

        const actual = result.transitionProject.project.engagements.items.find(
          (e: { id: ID }) => e.id === engagement.id
        );
        expect(actual.status.value).toBe(EngagementStatus[newStatus]);
      });
    }
  );

  /** Whenever an engagement's status gets changed to anything different the statusModifiedAt date should get set to now
   */
  it('should update Engagement statusModifiedAt if status is updated', async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const project = await createProject(app, {
      type: ProjectType.Internship,
      primaryLocationId: location.id,
    });
    const engagement = await createInternshipEngagement(app, {
      projectId: project.id,
    });
    // Update Project and Engagement status to Active
    await runAsAdmin(app, async () => {
      const actual = await transitionEngagementToActive(
        app,
        project.id,
        engagement.id
      );

      const modAtMillis = DateTime.fromISO(actual.modifiedAt).toMillis();
      const statusModMillis = DateTime.fromISO(
        actual.statusModifiedAt.value
      ).toMillis();
      expect(modAtMillis).toBe(statusModMillis);
    });
  });

  /**
   * Whenever an engagement's status gets set to Suspended the lastSuspendedAt date should get set to now
   */
  it('should update Engagement lastSuspendedAt if status gets set to Suspended', async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const project = await createProject(app, {
      type: ProjectType.Internship,
      primaryLocationId: location.id,
    });
    const engagement = await createInternshipEngagement(app, {
      projectId: project.id,
    });
    // Update Project status to Active
    await runAsAdmin(app, async () => {
      await transitionEngagementToActive(app, project.id, engagement.id);
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.DiscussingChangeToPlan
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.DiscussingSuspension
      );
      const actual = await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.Suspended
      );

      expect(actual.id).toBe(engagement.id);
      expect(actual.status.value).toBe(EngagementStatus.Suspended);
      expect(actual.statusModifiedAt.value).toBe(actual.modifiedAt);
      expect(actual.lastSuspendedAt.value).toBe(actual.modifiedAt);
    });
  });

  /**
   * Whenever an engagement's status gets set to Active after previously being Suspended the lastReactivatedAt date should get set to now
   */
  it('should update Engagement lastReactivatedAt if status gets set to Active from Suspended', async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const project = await createProject(app, {
      type: ProjectType.Internship,
      primaryLocationId: location.id,
    });
    const engagement = await createInternshipEngagement(app, {
      projectId: project.id,
    });

    // Update Project status to Active
    await runAsAdmin(app, async () => {
      await transitionEngagementToActive(app, project.id, engagement.id);
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.DiscussingChangeToPlan
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.DiscussingSuspension
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.Suspended
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.DiscussingReactivation
      );

      const actual = await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.ActiveChangedPlan
      );
      expect(actual.id).toBe(engagement.id);
      expect(actual.status.value).toBe(EngagementStatus.ActiveChangedPlan);
      // TODO: fix in a different iteration
      // expect(actual.lastReactivatedAt.value).toBe(
      //   actual.statusModifiedAt.value
      // );
    });
  });

  it('should not Create/Delete Engagement if Project status is not InDevelopment', async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const project = await createProject(app, {
      step: ProjectStep.EarlyConversations,
      primaryLocationId: location.id,
    });
    const engagement = await createLanguageEngagement(app, {
      projectId: project.id,
    });

    await runAsAdmin(app, async () => {
      for (const next of stepsFromEarlyConversationToBeforeActive) {
        await changeProjectStep(app, project.id, next);
      }
      await changeProjectStep(app, project.id, ProjectStep.Active);
    });

    await expect(
      createLanguageEngagement(app, {
        projectId: project.id,
      })
    ).rejects.toThrowError('The Project status is not in development');

    await expect(
      app.graphql.mutate(
        gql`
          mutation deleteEngagement($id: ID!) {
            deleteEngagement(id: $id) {
              __typename
            }
          }
        `,
        {
          id: engagement.id,
        }
      )
    ).rejects.toThrowError(
      'You do not have the permission to delete this Engagement'
    );
  });
});
