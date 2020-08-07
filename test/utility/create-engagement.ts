import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  InternPosition,
} from '../../src/components/engagement';
import { ProductMethodology } from '../../src/components/product';
import { TestApp } from './create-app';
import { createCountry } from './create-country';
import { createLanguage } from './create-language';
import { createPerson } from './create-person';
import { createProject } from './create-project';
import { getUserFromSession } from './create-session';
import {
  fragments,
  RawInternshipEngagement,
  RawLanguageEngagement,
} from './fragments';

export async function createLanguageEngagement(
  app: TestApp,
  input: Partial<CreateLanguageEngagement> = {}
) {
  const languageEngagement: CreateLanguageEngagement = {
    languageId: input.languageId ?? (await createLanguage(app)).id,
    projectId: input.projectId ?? (await createProject(app)).id,
    firstScripture: true,
    lukePartnership: true,
    disbursementCompleteDate: DateTime.local(),
    communicationsCompleteDate: DateTime.local(),
    startDateOverride: DateTime.local(),
    endDateOverride: DateTime.local(),
    completeDate: DateTime.local(),
    paraTextRegistryId: faker.random.word(),
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
  expect(isValid(actual.id)).toBe(true);
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
    countryOfOriginId: input.countryOfOriginId || (await createCountry(app)).id,
    internId: input.internId || currentUserId || (await createPerson(app)).id,
    mentorId: input.mentorId || currentUserId || (await createPerson(app)).id,
    position: InternPosition.AdministrativeSupportSpecialist,
    methodologies: [ProductMethodology.Film],
    disbursementCompleteDate: DateTime.local(),
    communicationsCompleteDate: DateTime.local(),
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
  expect(isValid(actual.id)).toBe(true);

  return actual;
}
