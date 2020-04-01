import { gql } from 'apollo-server-core';
import { CalendarDate } from '../../src/common';
import {
  CreateLanguageEngagement,
  LanguageEngagement,
} from '../../src/components/engagement';
import { TestApp } from './create-app';
import { createLanguage } from './create-language';
import { createProject } from './create-project';
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
    disbursementCompleteDate: CalendarDate.local(),
    communicationsCompleteDate: CalendarDate.local(),
    startDate: CalendarDate.local(),
    endDate: CalendarDate.local(),
    completeDate: CalendarDate.local(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createLanguageEngagement(
        $input: CreateLanguageEngagementInput!
      ) {
        createLanguageEngagement(input: $input) {
          engagement {
            ...engagement
          }
        }
      }
      ${fragments.languageEngagement}
    `,
    {
      input: {
        languageEngagement,
      },
    }
  );

  const actual: LanguageEngagement = result.createLanguageEngagement.engagement;

  expect(actual).toBeTruthy();

  return actual;
}
