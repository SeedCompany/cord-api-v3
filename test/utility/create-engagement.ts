import { gql } from 'apollo-server-core';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  InternPosition,
  InternshipEngagement,
  LanguageEngagement,
} from '../../src/components/engagement';
import { ProductMethodology } from '../../src/components/product';
import { TestApp } from './create-app';
import { createCountry } from './create-country';
import { createLanguage } from './create-language';
import { createProject } from './create-project';
import { createUser } from './create-user';
import { fragments } from './fragments';

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
    startDate: DateTime.local(),
    endDate: DateTime.local(),
    completeDate: DateTime.local(),
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

  const actual: LanguageEngagement = result.createLanguageEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValid(actual.id)).toBe(true);

  return actual;
}

export async function createInternshipEngagement(
  app: TestApp,
  input: Partial<CreateInternshipEngagement> = {}
) {
  const internshipEngagement: CreateInternshipEngagement = {
    projectId: input.projectId ?? (await createProject(app)).id,
    countryOfOriginId: input.countryOfOriginId ?? (await createCountry(app)).id,
    internId: input.internId ?? (await createUser(app)).id,
    mentorId: input.mentorId ?? (await createUser(app)).id,
    position: InternPosition.AdministrativeSupportSpecialist,
    methodologies: [ProductMethodology.Film],
    disbursementCompleteDate: DateTime.local(),
    communicationsCompleteDate: DateTime.local(),
    startDate: DateTime.local(),
    endDate: DateTime.local(),
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

  const actual: InternshipEngagement =
    result.createInternshipEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValid(actual.id)).toBe(true);

  return actual;
}
