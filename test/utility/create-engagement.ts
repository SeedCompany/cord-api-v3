import { faker } from '@faker-js/faker';
import { DateTime } from 'luxon';
import { ID, isValidId } from '~/common';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  InternshipPosition,
} from '../../src/components/engagement/dto';
import { ProductMethodology } from '../../src/components/product/dto';
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
import { gql } from './gql-tag';
import { runAsAdmin } from './login';

export async function createLanguageEngagement(
  app: TestApp,
  input: Partial<CreateLanguageEngagement> = {},
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
    paratextRegistryId: faker.lorem.word(),
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
    },
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
  input: Partial<CreateInternshipEngagement> = {},
) {
  const currentUserId = (await getUserFromSession(app)).id;
  const internshipEngagement: CreateInternshipEngagement = {
    projectId: input.projectId || (await createProject(app)).id,
    countryOfOriginId:
      input.countryOfOriginId ||
      (await runAsAdmin(app, async () => {
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
    },
  );

  const actual: RawInternshipEngagement =
    result.createInternshipEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

export async function createInternshipEngagementWithMinimumValues(
  app: TestApp,
  input: Partial<CreateInternshipEngagement> = {},
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
    },
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
  `,
  );

  expect(result).toBeTruthy();

  return result.engagement;
}
