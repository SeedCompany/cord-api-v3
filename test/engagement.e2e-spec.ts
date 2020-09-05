import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { some } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { generate } from 'shortid';
import {
  CreateInternshipEngagement,
  EngagementStatus,
  InternPosition,
  InternshipEngagement,
  LanguageEngagement,
} from '../src/components/engagement';
import { Language } from '../src/components/language';
import { Country, Region, Zone } from '../src/components/location';
import { ProductMethodology } from '../src/components/product';
import { Project, ProjectType } from '../src/components/project';
import { User } from '../src/components/user';
import {
  createCountry,
  createInternshipEngagement,
  createLanguage,
  createLanguageEngagement,
  createPerson,
  createProject,
  createRegion,
  createSession,
  createTestApp,
  createUser,
  createZone,
  expectNotFound,
  fragments,
  getUserFromSession,
  login,
  Raw,
  requestFileUpload,
  TestApp,
  uploadFileContents,
} from './utility';
import { createProduct } from './utility/create-product';

describe('Engagement e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;
  let internshipProject: Raw<Project>;
  let language: Language;
  let zone: Zone;
  let region: Region;
  let country: Country;
  let user: User;
  let intern: Partial<User>;
  let mentor: Partial<User>;
  const password: string = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();

    await createSession(app);

    user = await createUser(app, { password });
    language = await createLanguage(app);
    zone = await createZone(app, { directorId: user.id });
    region = await createRegion(app, { directorId: user.id, zoneId: zone.id });
    country = await createCountry(app, { regionId: region.id });
    intern = await getUserFromSession(app);
    mentor = await getUserFromSession(app);
    await login(app, { email: user.email.value, password });
  });

  afterAll(async () => {
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
      countryOfOriginId: country.id,
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
    expect(actual.firstScripture).toMatchObject(
      languageEngagement.lukePartnership
    );
    expect(actual.ceremony).toMatchObject(languageEngagement.ceremony);
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
      countryOfOriginId: country.id,
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
    expect(actual.ceremony).toMatchObject(internshipEngagement.ceremony);
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

  it('updates internship engagement', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const internshipEngagement = await createInternshipEngagement(app, {
      projectId: internshipProject.id,
      internId: intern.id,
    });
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
            // mentorId: mentor.id,
            countryOfOriginId: country.id,
            position: updatePosition,
            methodologies: updateMethodologies,
          },
        },
      }
    );

    const updated = result.updateInternshipEngagement.engagement;
    // console.log('updated.mentor ', JSON.stringify(updated, null, 2));
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(internshipEngagement.id);
    // expect(updated.mentor.value.id).toBe(mentor.id);
    expect(updated.countryOfOrigin.value.id).toBe(country.id);
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

  it('deletes engagement', async () => {
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

  it('has consistency in ceremony basenode', async () => {
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
    expect(languageEngagement.ceremony.value?.id).toBeDefined();
  });

  it('updates ceremony for language engagement', async () => {
    project = await createProject(app, { type: ProjectType.Translation });
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    expect(languageEngagement.ceremony.value?.id).toBeDefined();
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
            id: languageEngagement.ceremony.value?.id,
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
        id: languageEngagement.ceremony.value?.id,
      }
    );
    expect(result.ceremony.planned.value).toBeTruthy();
    expect(result.ceremony.estimatedDate.value).toBe(date);
  });

  it('updates ceremony for internship engagement', async () => {
    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const ie = await createInternshipEngagement(app, {
      projectId: internshipProject.id,
      internId: intern.id,
      mentorId: mentor.id,
      countryOfOriginId: country.id,
    });
    expect(ie.ceremony.value?.id).toBeDefined();
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
            id: ie.ceremony.value?.id,
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
        id: ie.ceremony.value?.id,
      }
    );
    expect(result.ceremony.planned.value).toBeTruthy();
    expect(result.ceremony.estimatedDate.value).toBe(date);
  });

  it('delete ceremony upon engagement deletion', async () => {
    project = await createProject(app);
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    expect(languageEngagement.ceremony.value?.id).toBeDefined();

    const ceremonyId = languageEngagement.ceremony.value?.id;

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
      countryOfOriginId: country.id,
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
    const invalidId = generate();
    await expect(
      createInternshipEngagement(app, {
        projectId: invalidId,
        countryOfOriginId: country.id,
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
        countryOfOriginId: country.id,
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
        countryOfOriginId: country.id,
        internId: intern.id,
        mentorId: invalidId,
      })
    ).rejects.toThrow('mentorId is invalid');
  });

  it('translation engagement creation fails and lets you know why if your ids are bad', async () => {
    const invalidId = generate();
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
    ).rejects.toThrowError();
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
});
