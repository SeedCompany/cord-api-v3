import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { DateTime, Interval } from 'luxon';
import { EngagementStatus, InternPosition } from '../src/components/engagement';
import { Language } from '../src/components/language';
import { Country, Region, Zone } from '../src/components/location';
import { ProductMethodology } from '../src/components/product';
import { Project } from '../src/components/project';
import { User } from '../src/components/user';
import {
  createCountry,
  createInternshipEngagement,
  createLanguage,
  createLanguageEngagement,
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
  TestApp,
} from './utility';

import _ = require('lodash');

describe('Engagement e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;
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
    project = await createProject(app);
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

  it('create a language engagement', async () => {
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
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
    expect(languageEngagement.status).toBe(EngagementStatus.InDevelopment);
  });

  it('create a internship engagement', async () => {
    const internEngagement = await createInternshipEngagement(app, {
      projectId: project.id,
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

  it('read a an language engagement by id', async () => {
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
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
  });

  it('read an internship engagement by id', async () => {
    const internshipEngagement = await createInternshipEngagement(app, {
      mentorId: mentor.id,
      projectId: project.id,
      countryOfOriginId: country.id,
      internId: intern.id,
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
  });

  it('update language engagement', async () => {
    const languageEngagement = await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
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
  });

  it('update internship engagement', async () => {
    const internshipEngagement = await createInternshipEngagement(app, {
      projectId: project.id,
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
            mentorId: mentor.id,
            countryOfOriginId: country.id,
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

  it('delete engagement', async () => {
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

  it('should have consistency in ceremony basenode', async () => {
    project = await createProject(app);
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

  it('should have consistency in language engagement nodes', async () => {
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

  it('should have consistency in internship engagement nodes', async () => {
    await createInternshipEngagement(app, {
      projectId: project.id,
      countryOfOriginId: country.id,
      internId: intern.id,
      mentorId: mentor.id,
    });
    const result = await app.graphql.query(
      gql`
        query checkEngagementConsistency($input: EngagementConsistencyInput!) {
          checkEngagementConsistency(input: $input)
        }
      `,
      {
        input: { baseNode: 'InternshipEngagement' },
      }
    );
    expect(result.checkEngagementConsistency).toBeTruthy();
  });

  it('should create ceremony upon engagement creation', async () => {
    project = await createProject(app);
    language = await createLanguage(app);
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    expect(languageEngagement.ceremony.value?.id).toBeDefined();
  });

  it('should update ceremony', async () => {
    project = await createProject(app);
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

  it('lists both language engagements and internship engagements', async () => {
    await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });
    await createInternshipEngagement(app, {
      projectId: project.id,
      countryOfOriginId: country.id,
      internId: intern.id,
      mentorId: mentor.id,
    });
    const { engagements } = await app.graphql.query(
      gql`
        query {
          engagements {
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
      _.some(engagements.items, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: 'InternshipEngagement',
      })
    ).toBeTruthy();
    expect(
      _.some(engagements.items, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __typename: 'LanguageEngagement',
      })
    ).toBeTruthy();
  });
});
