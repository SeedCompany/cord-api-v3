import { gql } from 'apollo-server-core';
import { InternPosition } from '../src/components/engagement';
import { Language } from '../src/components/language';
import { Country } from '../src/components/location';
import { ProductMethodology } from '../src/components/product';
import { Project } from '../src/components/project';
import { User } from '../src/components/user';
import {
  createLanguage,
  createProject,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';
import { createCountry } from './utility/create-country';
import {
  createInternshipEngagement,
  createLanguageEngagement,
} from './utility/create-engagement';

describe('Engagement e2e', () => {
  let app: TestApp;
  let project: Project;
  let language: Language;
  let country: Country;
  let intern: User;
  let mentor: User;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
    project = await createProject(app);
    language = await createLanguage(app);
    country = await createCountry(app);
    intern = await createUser(app);
    mentor = await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a language engagement', async () => {
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
    });

    expect(languageEngagement.id).toBeDefined();
  });

  it('create a internship engagement', async () => {
    const internEngagement = await createInternshipEngagement(app, {
      projectId: project.id,
      countryOfOriginId: country.id,
      internId: intern.id,
      mentorId: mentor.id,
    });
    expect(internEngagement.id).toBeDefined();
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
  });

  it('read a an internship engagement by id', async () => {
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
          },
        },
      }
    );

    const updated = result.updateLanguageEngagement.engagement;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(languageEngagement.id);
    expect(updated.firstScripture.value).toBe(updateFirstScripture);
    expect(updated.lukePartnership.value).toBe(updateLukePartnership);
  });

  it('update internship engagement', async () => {
    const internshipEngagement = await createInternshipEngagement(app, {
      projectId: project.id,
      internId: intern.id,
    });

    const updatePosition = InternPosition.LanguageProgramManager;
    const updateMethodologies = [ProductMethodology.Paratext];

    const result = await app.graphql.mutate(
      gql`
        mutation updateInternshipEngagement(
          $input: UpdateInternshipEngagementInput!
        ) {
          updateInternshipEngagement(input: $input) {
            engagement {
              ...internshipEngagement
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
    try {
      await app.graphql.query(
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
    } catch (e) {
      expect(e.response.statusCode).toBe(404);
    }
  });
});
