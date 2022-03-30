import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { DateTime } from 'luxon';
import { registerUser, runInIsolatedSession } from '.';
import { ID, isValidId } from '../../src/common';
import { Role } from '../../src/components/authorization/dto/role.dto';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  InternshipPosition,
} from '../../src/components/engagement';
import { ProductMethodology } from '../../src/components/product';
import { TestApp } from './create-app';
import { createLanguage } from './create-language';
import { createLocation } from './create-location';
import { createPerson } from './create-person';
import { createProject } from './create-project';
import { getUserFromSession } from './create-session';
import {
  fragments,
  RawInternshipEngagement,
  RawLanguageEngagement,
} from './fragments';
import { runAsAdmin } from './login';

export async function listInternshipEngagements(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        engagements(input: { filter: { type: "language" } }) {
          items {
            ...internshipEngagement
          }
        }
      }
      ${fragments.internshipEngagement}
    `
  );
  const engagements = result.engagements.items;
  expect(engagements).toBeTruthy();
  return engagements;
}
export async function listLanguageEngagements(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        engagements(input: { filter: { type: "language" } }) {
          items {
            ...languageEngagement
          }
        }
      }
      ${fragments.languageEngagement}
    `
  );
  const engagements = result.engagements.items;
  expect(engagements).toBeTruthy();
  return engagements;
}

export async function listCeremonies(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        ceremonies(input: {}) {
          items {
            ...ceremony
          }
        }
      }
      ${fragments.ceremony}
    `
  );
  const ceremonies = result.ceremonies.items;
  expect(ceremonies).toBeTruthy();
  return ceremonies;
}
export async function readOneCeremony(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query readOneCeremony($id: ID!) {
        ceremony(id: $id) {
          ...ceremony
        }
      }
      ${fragments.ceremony}
    `,
    { id }
  );
  const actual = result.ceremony;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneLanguageEngagementParatextId(
  app: TestApp,
  id: ID
) {
  const result = await app.graphql.query(
    gql`
      query readOneLanguageEngagementParatextId($id: ID!) {
        engagement(id: $id) {
          sensitivity
          ... on LanguageEngagement {
            paratextRegistryId {
              value
              canRead
              canEdit
            }
          }
        }
      }
    `,
    { id }
  );
  const actual: RawLanguageEngagement = result.engagement;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneInternshipEngagement(app: TestApp, id: ID) {
  const result = await app.graphql.query(
    gql`
      query readOneInternshipEngagement($id: ID!) {
        engagement(id: $id) {
          ...internshipEngagement
        }
      }
      ${fragments.internshipEngagement}
    `,
    { id }
  );
  const actual: RawInternshipEngagement = result.engagement;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneLanguageEngagement(app: TestApp, id: ID) {
  const result = await app.graphql.query(
    gql`
      query readOneLanguageEngagement($id: ID!) {
        engagement(id: $id) {
          ...languageEngagement
        }
      }
      ${fragments.languageEngagement}
    `,
    { id }
  );
  const actual: RawLanguageEngagement = result.engagement;
  expect(actual).toBeTruthy();
  return actual;
}

export async function createLanguageEngagement(
  app: TestApp,
  input: Partial<CreateLanguageEngagement> = {}
) {
  const languageEngagement: CreateLanguageEngagement = {
    languageId:
      input.languageId ??
      (await runAsAdmin(app, async () => {
        return (await createLanguage(app)).id;
      })),
    projectId: input.projectId ?? (await createProject(app)).id,
    lukePartnership: true,
    disbursementCompleteDate: DateTime.local(),
    startDateOverride: DateTime.local(),
    endDateOverride: DateTime.local(),
    completeDate: DateTime.local(),
    paratextRegistryId: faker.random.word(),
    ...input,
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

  const actual: RawLanguageEngagement =
    result.createLanguageEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);
  expect(actual.modifiedAt).toBeTruthy();
  return actual;
}

export async function createInternshipEngagement(
  app: TestApp,
  input: Partial<CreateInternshipEngagement> = {}
) {
  const currentUserId = (await getUserFromSession(app)).id;
  const internshipEngagement: CreateInternshipEngagement = {
    projectId: input.projectId || (await createProject(app)).id,
    countryOfOriginId:
      input.countryOfOriginId ||
      (await runInIsolatedSession(app, async () => {
        await registerUser(app, { roles: [Role.Administrator] }); // only admin role can create a location for now
        return (await createLocation(app)).id;
      })),
    internId: input.internId || currentUserId || (await createPerson(app)).id,
    mentorId: input.mentorId || currentUserId || (await createPerson(app)).id,
    position: InternshipPosition.Administration,
    methodologies: [ProductMethodology.Film],
    disbursementCompleteDate: DateTime.local(),
    startDateOverride: DateTime.local(),
    endDateOverride: DateTime.local(),
    completeDate: DateTime.local(),
    ...input,
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

  const actual: RawInternshipEngagement =
    result.createInternshipEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

export async function createInternshipEngagementWithMinimumValues(
  app: TestApp,
  input: Partial<CreateInternshipEngagement> = {}
) {
  const currentUserId = (await getUserFromSession(app)).id;
  const internshipEngagement: CreateInternshipEngagement = {
    projectId: input.projectId || (await createProject(app)).id,
    internId: input.internId || currentUserId || (await createPerson(app)).id,
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

  const actual: RawInternshipEngagement =
    result.createInternshipEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

export async function getCurrentEngagementStatus(app: TestApp, id: ID) {
  const result = await app.graphql.query(
    gql`
    query {
      engagement(id: "${id}"){
          modifiedAt
          statusModifiedAt {
            value
          }
          status {
            value
            transitions {
              to
              type
            }
          }
      }
    }
  `
  );

  expect(result).toBeTruthy();

  return result.engagement;
}
