import { faker } from '@faker-js/faker';
import { some } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { generateId, type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  EngagementStatus,
  InternshipPosition,
} from '../src/components/engagement/dto';
import { ProductMethodology } from '../src/components/product/dto';
import { ProjectStep, ProjectType } from '../src/components/project/dto';
import {
  createDirectProduct,
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
  errors,
  fragments,
  getUserFromSession,
  registerUser,
  requestFileUpload,
  runAsAdmin,
  type TestApp,
  type TestUser,
  uploadFileContents,
} from './utility';
import {
  changeInternshipEngagementStatus,
  transitionEngagementToActive,
} from './utility/transition-engagement';
import {
  changeProjectStep,
  forceProjectTo,
  getProjectTransitions,
  stepsFromEarlyConversationToBeforeActive,
  transitionProject,
} from './utility/transition-project';

describe('Engagement e2e', () => {
  let app: TestApp;
  let project: fragments.project;
  let internshipProject: fragments.project;
  let language: fragments.language;
  let location: fragments.location;
  let user: TestUser;
  let intern: { id: ID };
  let mentor: { id: ID };

  beforeAll(async () => {
    app = await createTestApp();

    await createSession(app);

    user = await registerUser(app, {
      roles: [
        Role.ProjectManager,
        Role.FieldOperationsDirector,
        Role.Consultant,
      ],
    });
    [language, location] = await runAsAdmin(app, async () => {
      const language = await createLanguage(app);
      const location = await createLocation(app);
      return [language, location];
    });

    intern = await getUserFromSession(app);
    mentor = await getUserFromSession(app);
  });

  afterAll(async () => {
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
      DateTime.local(),
    )
      .toDuration()
      .toFormat('S');
    expect(parseInt(difference)).toBeGreaterThan(0);
    expect(languageEngagement.status.value).toBe(
      EngagementStatus.InDevelopment,
    );
  });

  it('create a language engagement with only required fields', async () => {
    project = await createProject(app);
    const languageEngagement = {
      languageId: language.id,
      projectId: project.id,
    };
    const result = await app.graphql.mutate(
      graphql(
        `
          mutation createLanguageEngagement(
            $input: CreateLanguageEngagementInput!
          ) {
            createLanguageEngagement(input: $input) {
              engagement {
                ...languageEngagement
              }
            }
          }
        `,
        [fragments.languageEngagement],
      ),
      {
        input: {
          engagement: languageEngagement,
        },
      },
    );

    const actual = result.createLanguageEngagement.engagement;
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
      DateTime.local(),
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

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation createInternshipEngagement(
            $input: CreateInternshipEngagement!
          ) {
            createInternshipEngagement(input: { engagement: $input }) {
              engagement {
                ...internshipEngagement
              }
            }
          }
        `,
        [fragments.internshipEngagement],
      ),
      {
        input: {
          projectId: internshipProject.id,
          internId: user.id,
        },
      },
    );

    const actual = result.createInternshipEngagement.engagement;
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

  it('reads a language engagement by id', async () => {
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
      graphql(
        `
          query engagement($id: ID!) {
            engagement: languageEngagement(id: $id) {
              ...languageEngagement
            }
          }
        `,
        [fragments.languageEngagement],
      ),
      {
        id: languageEngagement.id,
      },
    );

    expect(actual.id).toBe(languageEngagement.id);
    expect(actual.language).toMatchObject(languageEngagement.language);
    expect(actual.firstScripture).toMatchObject(
      languageEngagement.firstScripture,
    );
    expect(actual.lukePartnership).toMatchObject(
      languageEngagement.lukePartnership,
    );
    expect(actual.ceremony).toBeDefined();
    expect(actual.completeDate).toMatchObject(languageEngagement.completeDate);
    expect(actual.disbursementCompleteDate).toMatchObject(
      languageEngagement.disbursementCompleteDate,
    );
    expect(actual.startDate).toMatchObject(languageEngagement.startDate);
    expect(actual.endDate).toMatchObject(languageEngagement.endDate);
    expect(actual.modifiedAt).toBe(languageEngagement.modifiedAt);
    expect(actual.paratextRegistryId).toMatchObject(
      languageEngagement.paratextRegistryId,
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
      graphql(
        `
          query engagement($id: ID!) {
            engagement(id: $id) {
              __typename
              ...internshipEngagement
            }
          }
        `,
        [fragments.internshipEngagement],
      ),
      {
        id: internshipEngagement.id,
      },
    );
    if (actual.__typename !== 'InternshipEngagement') throw new Error();

    expect(actual.id).toBe(internshipEngagement.id);
    expect(actual.intern).toMatchObject(internshipEngagement.intern);
    expect(actual.mentor).toMatchObject(internshipEngagement.mentor);
    expect(actual.countryOfOrigin).toMatchObject(
      internshipEngagement.countryOfOrigin,
    );
    expect(actual.methodologies).toMatchObject(
      internshipEngagement.methodologies,
    );
    expect(actual.position).toMatchObject(internshipEngagement.position);
    expect(actual.ceremony).toBeDefined();
    expect(actual.completeDate).toMatchObject(
      internshipEngagement.completeDate,
    );
    expect(actual.disbursementCompleteDate).toMatchObject(
      internshipEngagement.disbursementCompleteDate,
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
    const updateParatextRegistryId = faker.lorem.word();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateLanguageEngagement(
            $input: UpdateLanguageEngagementInput!
          ) {
            updateLanguageEngagement(input: $input) {
              engagement {
                ...languageEngagement
              }
            }
          }
        `,
        [fragments.languageEngagement],
      ),
      {
        input: {
          engagement: {
            id: languageEngagement.id,
            firstScripture: updateFirstScripture,
            lukePartnership: updateLukePartnership,
            paratextRegistryId: updateParatextRegistryId,
          },
        },
      },
    );
    const updated = result.updateLanguageEngagement.engagement;
    expect(updated).toBeTruthy();
    expect(DateTime.fromISO(updated.modifiedAt).toMillis()).toBeGreaterThan(
      DateTime.fromISO(languageEngagement.modifiedAt).toMillis(),
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
      graphql(
        `
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
        `,
        [fragments.internshipEngagement],
      ),
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
      },
    );

    const updated = result.updateInternshipEngagement.engagement;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(internshipEngagement.id);
    expect(updated.mentor.value!.id).toBe(mentor.id);
    expect(updated.countryOfOrigin.value!.id).toBe(location.id);
    expect(updated.position.value).toBe(updatePosition);
    expect(updated.methodologies.value).toEqual(
      expect.arrayContaining(updateMethodologies),
    );

    const difference = Interval.fromDateTimes(
      DateTime.fromISO(internshipEngagement.modifiedAt.toString()),
      DateTime.fromISO(updated.modifiedAt),
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
      graphql(`
        mutation deleteEngagement($id: ID!) {
          deleteEngagement(id: $id) {
            __typename
          }
        }
      `),
      {
        id: languageEngagement.id,
      },
    );

    const actual = result.deleteEngagement;
    expect(actual).toBeTruthy();
    await app.graphql
      .query(
        graphql(
          `
            query engagement($id: ID!) {
              engagement(id: $id) {
                ...languageEngagement
              }
            }
          `,
          [fragments.languageEngagement],
        ),
        {
          id: languageEngagement.id,
        },
      )
      .expectError(errors.notFound());
  });

  it('returns the correct products in language engagement', async () => {
    project = await createProject(app);
    language = await runAsAdmin(app, createLanguage);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const product1 = await createDirectProduct(app, {
      engagementId: languageEngagement.id,
    });
    const product2 = await createDirectProduct(app, {
      engagementId: languageEngagement.id,
    });
    const result = await app.graphql.query(
      graphql(
        `
          query engagement($id: ID!) {
            engagement: languageEngagement(id: $id) {
              ...languageEngagement
            }
          }
        `,
        [fragments.languageEngagement],
      ),
      {
        id: languageEngagement.id,
      },
    );
    expect(result.engagement.products.total).toEqual(2);
    expect(result.engagement.products.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: product1.id,
        }),
      ]),
    );
    expect(result.engagement.products.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: product2.id,
        }),
      ]),
    );
  });

  it('creates ceremony upon engagement creation', async () => {
    project = await createProject(app);
    language = await runAsAdmin(app, createLanguage);

    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const result = await app.graphql.query(
      graphql(
        `
          query engagement($id: ID!) {
            engagement(id: $id) {
              ...engagement
            }
          }
        `,
        [fragments.engagement],
      ),
      {
        id: languageEngagement.id,
      },
    );

    expect(result.engagement.ceremony.value?.id).toBeDefined();
  });

  it('updates ceremony for language engagement', async () => {
    project = await createProject(app, {
      type: ProjectType.MomentumTranslation,
    });
    language = await runAsAdmin(app, createLanguage);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const languageEngagementRead = await app.graphql.query(
      graphql(
        `
          query engagement($id: ID!) {
            engagement(id: $id) {
              ...engagement
            }
          }
        `,
        [fragments.engagement],
      ),
      {
        id: languageEngagement.id,
      },
    );
    const ceremony = languageEngagementRead.engagement.ceremony.value!;
    expect(ceremony).toBeDefined();

    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    const date = '2020-05-13';
    const result = await app.graphql.mutate(
      graphql(`
        mutation updateCeremony($input: UpdateCeremonyInput!) {
          updateCeremony(input: $input) {
            ceremony {
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
        }
      `),
      {
        input: {
          ceremony: {
            id: ceremony.id,
            planned: true,
            estimatedDate: date,
          },
        },
      },
    );
    expect(result.updateCeremony.ceremony.planned.value).toBeTruthy();
    expect(result.updateCeremony.ceremony.estimatedDate.value).toBe(date);

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
      graphql(
        `
          query engagement($id: ID!) {
            engagement(id: $id) {
              ...engagement
            }
          }
        `,
        [fragments.engagement],
      ),
      {
        id: ie.id,
      },
    );
    const ceremony = internshipEngagementRead.engagement.ceremony.value!;
    expect(ceremony).toBeDefined();

    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    const date = '2020-05-13';
    const result = await app.graphql.mutate(
      graphql(`
        mutation updateCeremony($input: UpdateCeremonyInput!) {
          updateCeremony(input: $input) {
            ceremony {
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
        }
      `),
      {
        input: {
          ceremony: {
            id: ceremony.id,
            planned: true,
            estimatedDate: date,
          },
        },
      },
    );
    expect(result.updateCeremony.ceremony.planned.value).toBeTruthy();
    expect(result.updateCeremony.ceremony.estimatedDate.value).toBe(date);

    await user.login();
  });

  it.skip('delete ceremony upon engagement deletion', async () => {
    project = await createProject(app);
    language = await runAsAdmin(app, createLanguage);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    const languageEngagementRead = await app.graphql.query(
      graphql(
        `
          query engagement($id: ID!) {
            engagement(id: $id) {
              ...engagement
            }
          }
        `,
        [fragments.engagement],
      ),
      {
        id: languageEngagement.id,
      },
    );

    expect(languageEngagementRead.engagement.ceremony.value?.id).toBeDefined();

    const ceremonyId = languageEngagementRead.engagement.ceremony.value?.id;

    await app.graphql.mutate(
      graphql(`
        mutation deleteEngagement($id: ID!) {
          deleteEngagement(id: $id) {
            __typename
          }
        }
      `),
      {
        id: languageEngagement.id,
      },
    );

    await app.graphql
      .query(
        graphql(
          `
            query ceremony($id: ID!) {
              ceremony(id: $id) {
                ...ceremony
              }
            }
          `,
          [fragments.ceremony],
        ),
        {
          id: ceremonyId!,
        },
      )
      .expectError(errors.notFound());
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
      graphql(`
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
      `),
    );

    expect(
      some(engagements.items, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: 'InternshipEngagement',
      }),
    ).toBeTruthy();
    expect(
      some(engagements.items, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: 'LanguageEngagement',
      }),
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
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: expect.stringMatching(/Could not find project/i),
      }),
    );
    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: invalidId,
        internId: intern.id,
        mentorId: mentor.id,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({ message: 'Could not find country of origin' }),
    );

    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });

    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: location.id,
        internId: invalidId,
        mentorId: mentor.id,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({ message: 'Could not find person' }),
    );

    internshipProject = await createProject(app, {
      type: ProjectType.Internship,
    });

    await expect(
      createInternshipEngagement(app, {
        projectId: internshipProject.id,
        countryOfOriginId: location.id,
        internId: intern.id,
        mentorId: invalidId,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({ message: 'Could not find mentor' }),
    );
  });

  it('language engagement creation fails and lets you know why if your ids are bad', async () => {
    const invalidId = await generateId();
    await expect(
      createLanguageEngagement(app, {
        projectId: invalidId,
        languageId: language.id,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: expect.stringMatching(/Could not find project/i),
      }),
    );
    await expect(
      createLanguageEngagement(app, {
        projectId: project.id,
        languageId: invalidId,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({ message: 'Could not find language' }),
    );
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
      graphql(`
        query EngagementById($id: ID!) {
          engagement(id: $id) {
            __typename
            ... on InternshipEngagement {
              id
              methodologies {
                value
              }
            }
          }
        }
      `),
      {
        id: internshipEngagement.id,
      },
    );
    if (actual.__typename !== 'InternshipEngagement') throw new Error();
    expect(actual.methodologies).toBeDefined();
    expect(actual.methodologies.value).toMatchObject([]);
  });

  it('should throw error if Project type does not match with Engagement type', async () => {
    project = await createProject(app);
    await expect(
      createInternshipEngagement(app, {
        projectId: project.id,
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'Only Internship Engagements can be created on Internship Projects',
        field: 'engagement.internId',
      }),
    );
  });

  it('should throw error if language engagement already exists with same project and language', async () => {
    const project = await createProject(app);
    const language = await runAsAdmin(app, createLanguage);

    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

    await expect(
      createLanguageEngagement(app, {
        projectId: project.id,
        languageId: language.id,
      }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Engagement for this project and language already exists',
        field: 'engagement.languageId',
      }),
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
      }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Engagement for this project and person already exists',
        field: 'engagement.internId',
      }),
    );
  });

  it('can not set firstScripture=true if the language has hasExternalFirstScripture=true', async () => {
    language = await runAsAdmin(app, async () => {
      return await createLanguage(app, { hasExternalFirstScripture: true });
    });
    await expect(
      createLanguageEngagement(app, {
        languageId: language.id,
        firstScripture: true,
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'First scripture has already been marked as having been done externally',
        field: 'languageEngagement.firstScripture',
      }),
    );
  });

  it('can not set firstScripture=true if it is not only engagement for the language that has firstScripture=true', async () => {
    language = await runAsAdmin(app, createLanguage);
    await createLanguageEngagement(app, {
      languageId: language.id,
      firstScripture: true,
    });
    await createLanguageEngagement(app, { languageId: language.id });
    await expect(
      createLanguageEngagement(app, {
        languageId: language.id,
        firstScripture: true,
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'Another engagement has already been marked as having done the first scripture',
        field: 'languageEngagement.firstScripture',
      }),
    );
  });

  it('Projects cannot be completed with engagements not finalizing or terminal', async () => {
    const location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      return location;
    });

    const project = await createProject(app, {
      primaryLocationId: location.id,
    });
    await createLanguageEngagement(app, {
      projectId: project.id,
    });

    // Change the project & engagement to FinalizingCompletion
    await forceProjectTo(app, project.id, 'FinalizingCompletion');

    // Add another engagement not FinalizingCompletion
    await runAsAdmin(app, async () => {
      await createLanguageEngagement(app, {
        projectId: project.id,
      });
    });

    // Read available transitions
    const {
      step: { transitions },
    } = await getProjectTransitions(app, project.id);

    const toCompletedTransition = transitions.find((t) => t.to === 'Completed');

    expect(toCompletedTransition?.disabled).toBe(true);
    expect(toCompletedTransition?.disabledReason).toBe(
      'The project cannot be completed since some ongoing engagements are not "Finalizing Completion"',
    );

    await expect(
      transitionProject(app, {
        project: project.id,
        transition: toCompletedTransition?.key,
      }),
    ).rejects.toThrowGqlError(
      errors.unauthorized({
        message: 'This transition is not available',
      }),
    );
  });

  it.each([
    [
      ProjectStep.PendingFinanceConfirmation,
      ProjectStep.Active,
      EngagementStatus.Active,
    ],
    [
      ProjectStep.EarlyConversations,
      ProjectStep.DidNotDevelop,
      EngagementStatus.DidNotDevelop,
    ],
    [
      ProjectStep.PendingFinanceConfirmation,
      ProjectStep.Rejected,
      EngagementStatus.Rejected,
    ],
    [
      ProjectStep.PendingTerminationApproval,
      ProjectStep.Terminated,
      EngagementStatus.Terminated,
    ],
    // this only happens when an admin overrides to completed
    // this is prohibited if there are non terminal engagements
    [
      ProjectStep.FinalizingCompletion,
      ProjectStep.Completed,
      EngagementStatus.Completed,
    ],
  ])(
    'should update Engagement status to match Project step when it becomes %s',
    async (
      currentStepSetup: ProjectStep,
      nextStep: ProjectStep,
      expectedNewStatus: EngagementStatus,
    ) => {
      const location = await runAsAdmin(app, async () => {
        const fundingAccount = await createFundingAccount(app);
        const location = await createLocation(app, {
          fundingAccountId: fundingAccount.id,
        });
        return location;
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });
      const engagement = await createLanguageEngagement(app, {
        projectId: project.id,
      });
      const {
        step: { transitions },
      } = await forceProjectTo(app, project.id, currentStepSetup);

      // ignoring proper transition permissions
      await runAsAdmin(app, async () => {
        const transition = transitions.find((t) => t.to === nextStep);
        await transitionProject(app, {
          project: project.id,
          transition: transition?.key,
        });
      });

      const {
        project: { engagements },
      } = await app.graphql.query(
        graphql(`
          query EngagementStatus($id: ID!) {
            project(id: $id) {
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
        `),
        {
          id: project.id,
        },
      );
      const actual = engagements.items.find((e) => e.id === engagement.id);
      expect(actual?.status.value).toBe(expectedNewStatus);
    },
  );

  /** Whenever an engagement's status gets changed to anything different the statusModifiedAt date should get set to now
   */
  it('should update Engagement statusModifiedAt if status is updated', async () => {
    const location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      return location;
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
        engagement.id,
      );

      const modAtMillis = DateTime.fromISO(actual.modifiedAt).toMillis();
      const statusModMillis = DateTime.fromISO(
        actual.statusModifiedAt.value!,
      ).toMillis();
      expect(modAtMillis).toBe(statusModMillis);
    });
  });

  /**
   * Whenever an engagement's status gets set to Suspended the lastSuspendedAt date should get set to now
   */
  it('should update Engagement lastSuspendedAt if status gets set to Suspended', async () => {
    const location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      return location;
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
        ProjectStep.DiscussingChangeToPlan,
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.DiscussingSuspension,
      );
      const actual = await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.Suspended,
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
    const location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      return location;
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
        ProjectStep.DiscussingChangeToPlan,
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.DiscussingSuspension,
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.Suspended,
      );
      await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.DiscussingReactivation,
      );

      const actual = await changeInternshipEngagementStatus(
        app,
        engagement.id,
        EngagementStatus.ActiveChangedPlan,
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
    const location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      return location;
    });
    const project = await createProject(app, {
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
      }),
    ).rejects.toThrowGqlError(
      errors.unauthorized({
        message:
          'You do not have the permission to create engagement for this project',
      }),
    );

    await expect(
      app.graphql.mutate(
        graphql(`
          mutation deleteEngagement($id: ID!) {
            deleteEngagement(id: $id) {
              __typename
            }
          }
        `),
        {
          id: engagement.id,
        },
      ),
    ).rejects.toThrowGqlError(
      errors.unauthorized({
        message:
          'You do not have the permission to delete this language engagement',
      }),
    );
  });
});
