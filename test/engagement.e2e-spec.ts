import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { some } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { generateId, InputException } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import {
  CreateInternshipEngagement,
  EngagementStatus,
  InternPosition,
  InternshipEngagement,
  LanguageEngagement,
} from '../src/components/engagement';
import { Language } from '../src/components/language';
import { Location } from '../src/components/location';
import { ProductMethodology } from '../src/components/product';
import {
  Project,
  ProjectStatus,
  ProjectStep,
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
  createProject,
  createSession,
  createTestApp,
  expectNotFound,
  fragments,
  getUserFromSession,
  Raw,
  registerUserWithPower,
  requestFileUpload,
  runAsAdmin,
  TestApp,
  uploadFileContents,
} from './utility';
import { createProduct } from './utility/create-product';
import { resetDatabase } from './utility/reset-database';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

describe('Engagement e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;
  let internshipProject: Raw<Project>;
  let language: Language;
  let location: Location;
  let user: User;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);

    await createSession(app);

    user = await registerUserWithPower(app, [
      Powers.CreateLanguage,
      Powers.CreateEthnologueLanguage,
    ]);
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
      status: EngagementStatus.AwaitingDedication,
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
    expect(languageEngagement.status).toBe(EngagementStatus.AwaitingDedication);
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
    expect(actual.communicationsCompleteDate.value).toBeNull();
    expect(actual.startDate.value).toBe(project.mouStart.value);
    expect(actual.endDate.value).toBe(project.mouEnd.value);
    expect(actual.initialEndDate.value).toBeNull();
    expect(actual.lastSuspendedAt.value).toBeNull();
    expect(actual.lastReactivatedAt.value).toBeNull();
    expect(actual.statusModifiedAt.value).toBeNull();
    expect(actual.paraTextRegistryId.value).toBeNull();
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
    expect(internEngagement.status).toBe(EngagementStatus.InDevelopment);
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
    expect(actual.communicationsCompleteDate.value).toBeNull();
    expect(actual.startDate.value).toBe(internshipProject.mouStart.value);
    expect(actual.endDate.value).toBe(internshipProject.mouEnd.value);
    expect(actual.initialEndDate.value).toBeNull();
    expect(actual.lastSuspendedAt.value).toBeNull();
    expect(actual.lastReactivatedAt.value).toBeNull();
    expect(actual.statusModifiedAt.value).toBeNull();
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
    expect(actual.communicationsCompleteDate).toMatchObject(
      languageEngagement.communicationsCompleteDate
    );
    expect(actual.startDate).toMatchObject(languageEngagement.startDate);
    expect(actual.endDate).toMatchObject(languageEngagement.endDate);
    expect(actual.modifiedAt).toBe(languageEngagement.modifiedAt);
    expect(actual.paraTextRegistryId).toMatchObject(
      languageEngagement.paraTextRegistryId
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
    expect(actual.communicationsCompleteDate).toMatchObject(
      internshipEngagement.communicationsCompleteDate
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
      status: EngagementStatus.Rejected,
    });

    const updateFirstScripture = false;
    const updateLukePartnership = false;
    const updateParaTextRegistryId = faker.random.word();

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
            paraTextRegistryId: updateParaTextRegistryId,
          },
        },
      }
    );
    const updated = result.updateLanguageEngagement.engagement;
    const difference = Interval.fromDateTimes(
      DateTime.fromISO(languageEngagement.modifiedAt.toString()),
      DateTime.fromISO(updated.modifiedAt)
    )
      .toDuration()
      .toFormat('S');
    expect(updated).toBeTruthy();
    expect(parseInt(difference)).toBeGreaterThan(0);
    expect(updated.id).toBe(languageEngagement.id);
    expect(updated.firstScripture.value).toBe(updateFirstScripture);
    expect(updated.lukePartnership.value).toBe(updateLukePartnership);
    expect(updated.paraTextRegistryId.value).toBe(updateParaTextRegistryId);
    expect(updated.status).toBe(EngagementStatus.Rejected);
  });

  // needs to be updated to use project roles
  it.skip('updates internship engagement', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const mentor = await registerUserWithPower(app, [
      Powers.CreateLanguage,
      Powers.CreateEthnologueLanguage,
    ]);
    const internshipEngagement = await createInternshipEngagementWithMinimumValues(
      app,
      {
        projectId: internshipProject.id,
        internId: intern.id,
      }
    );
    const updatePosition = InternPosition.LanguageProgramManager;
    const updateMethodologies = [
      ProductMethodology.Paratext,
      ProductMethodology.BibleStories,
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
          deleteEngagement(id: $id)
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

  it.skip('has consistency in ceremony basenode', async () => {
    project = await createProject(app, { type: ProjectType.Translation });
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    expect(languageEngagement.id).toBeDefined();
    const testResult = await app.graphql.query(
      gql`
        query checkCeremonyConsistency {
          checkCeremonyConsistency
        }
      `
    );
    expect(testResult.checkCeremonyConsistency).toBeTruthy();
  });

  it.skip('has consistency in language engagement nodes', async () => {
    project = await createProject(app);
    language = await createLanguage(app);
    await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    const result = await app.graphql.query(
      gql`
        query checkEngagementConsistency($input: EngagementConsistencyInput!) {
          checkEngagementConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'LanguageEngagement' },
      }
    );
    expect(result.checkEngagementConsistency).toBeTruthy();
  });

  // needs to be updated to use project roles
  it.skip('returns the correct products in language engagement', async () => {
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

  it('has consistency in language engagement nodes', async () => {
    project = await createProject(app);
    language = await createLanguage(app);
    await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    const result = await app.graphql.query(
      gql`
        query checkEngagementConsistency($input: EngagementConsistencyInput!) {
          checkEngagementConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'LanguageEngagement' },
      }
    );
    expect(result.checkEngagementConsistency).toBeTruthy();
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

  it.skip('updates ceremony for language engagement', async () => {
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
  });

  it.skip('updates ceremony for internship engagement', async () => {
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
          deleteEngagement(id: $id)
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
    ).rejects.toThrow('projectId is invalid');
    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: invalidId,
        internId: intern.id,
        mentorId: mentor.id,
      })
    ).rejects.toThrow('countryOfOriginId is invalid');

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
    ).rejects.toThrow('internId is invalid');

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
    ).rejects.toThrow('mentorId is invalid');
  });

  it('translation engagement creation fails and lets you know why if your ids are bad', async () => {
    const invalidId = await generateId();
    await expect(
      createLanguageEngagement(app, {
        projectId: invalidId,
        languageId: language.id,
      })
    ).rejects.toThrow('projectId is invalid');
    await expect(
      createLanguageEngagement(app, {
        projectId: project.id,
        languageId: invalidId,
      })
    ).rejects.toThrow('languageId is invalid');
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
        'That Project type is not Internship',
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
    const intern = await registerUserWithPower(app, [
      Powers.CreateLanguage,
      Powers.CreateEthnologueLanguage,
    ]);

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
      'firstScripture can not be set to true if the language has hasExternalFirstScripture=true'
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
      'firstScripture can not be set to true if it is not the only engagement for the language that has firstScripture=true'
    );
  });

  // needs to be updated to use project roles
  it.skip('should update Engagement status to Active if Project becomes Active from InDevelopment', async () => {
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
    expect(engagement.status !== EngagementStatus.Active).toBe(true);

    await runAsAdmin(app, async () => {
      for (const next of stepsFromEarlyConversationToBeforeActive) {
        await changeProjectStep(app, project.id, next);
      }

      // Update Project status to Active, and ensure result from this specific
      // operation returns the correct engagement status
      const result = await app.graphql.mutate(
        gql`
          mutation updateProject($id: ID!) {
            updateProject(input: { project: { id: $id, step: Active } }) {
              project {
                id
                departmentId {
                  value
                }
                engagements {
                  items {
                    id
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

      const actual = result.updateProject.project.engagements.items.find(
        (e: { id: string }) => e.id === engagement.id
      );
      expect(actual.status).toBe(EngagementStatus.Active);
      expect(result.updateProject.project.departmentId.value).toContain(
        fundingAccount.accountNumber.value
      );
    });
  });

  /**
   * Whenever an engagement's status gets changed to anything different the statusModifiedAt date should get set to now
   */
  it('should update Engagement statusModifiedAt if status is updated', async () => {
    const project = await createProject(app, { type: ProjectType.Internship });
    const engagement = await createInternshipEngagement(app, {
      projectId: project.id,
    });

    // Update Engagement status to AwaitingDedication
    const {
      updateInternshipEngagement: { engagement: actual },
    } = await app.graphql.mutate(
      gql`
        mutation updateInternshipEngagement($id: ID!) {
          updateInternshipEngagement(
            input: { engagement: { id: $id, status: AwaitingDedication } }
          ) {
            engagement {
              ...internshipEngagement
            }
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        id: engagement.id,
      }
    );

    expect(actual.id).toBe(engagement.id);
    expect(actual.status).toBe(EngagementStatus.AwaitingDedication);
    expect(actual.statusModifiedAt.value).toBe(actual.modifiedAt);
  });

  /**
   * Whenever an engagement's status gets set to Suspended the lastSuspendedAt date should get set to now
   */
  it('should update Engagement lastSuspendedAt if status gets set to Suspended', async () => {
    const project = await createProject(app, { type: ProjectType.Internship });
    const engagement = await createInternshipEngagement(app, {
      projectId: project.id,
    });

    // Update Engagement status to Suspended
    const {
      updateInternshipEngagement: { engagement: actual },
    } = await app.graphql.mutate(
      gql`
        mutation updateInternshipEngagement($id: ID!) {
          updateInternshipEngagement(
            input: { engagement: { id: $id, status: Suspended } }
          ) {
            engagement {
              ...internshipEngagement
            }
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        id: engagement.id,
      }
    );

    expect(actual.id).toBe(engagement.id);
    expect(actual.status).toBe(EngagementStatus.Suspended);
    expect(actual.statusModifiedAt.value).toBe(actual.modifiedAt);
    expect(actual.lastSuspendedAt.value).toBe(actual.modifiedAt);
  });

  /**
   * Whenever an engagement's status gets set to Active after previously being Suspended the lastReactivatedAt date should get set to now
   */
  it('should update Engagement lastReactivatedAt if status gets set to Active from Suspended', async () => {
    const project = await createProject(app, { type: ProjectType.Internship });
    const engagement = await createInternshipEngagement(app, {
      projectId: project.id,
    });

    // Update Engagement status to Suspended
    await app.graphql.mutate(
      gql`
        mutation updateInternshipEngagement($id: ID!) {
          updateInternshipEngagement(
            input: { engagement: { id: $id, status: Suspended } }
          ) {
            engagement {
              ...internshipEngagement
            }
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        id: engagement.id,
      }
    );

    // Update Engagement status to Active
    const {
      updateInternshipEngagement: { engagement: actual },
    } = await app.graphql.mutate(
      gql`
        mutation updateInternshipEngagement($id: ID!) {
          updateInternshipEngagement(
            input: { engagement: { id: $id, status: Active } }
          ) {
            engagement {
              ...internshipEngagement
            }
          }
        }
        ${fragments.internshipEngagement}
      `,
      {
        id: engagement.id,
      }
    );

    expect(actual.id).toBe(engagement.id);
    expect(actual.status).toBe(EngagementStatus.Active);
    expect(actual.statusModifiedAt.value).toBe(actual.modifiedAt);
    expect(actual.lastReactivatedAt.value).toBe(actual.modifiedAt);
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

      await expect(
        createLanguageEngagement(app, {
          projectId: project.id,
        })
      ).rejects.toThrowError('The Project status is not in development');

      await expect(
        app.graphql.mutate(
          gql`
            mutation deleteEngagement($id: ID!) {
              deleteEngagement(id: $id)
            }
          `,
          {
            id: engagement.id,
          }
        )
      ).rejects.toThrowError('The Project status is not in development');
    });
  });
});
