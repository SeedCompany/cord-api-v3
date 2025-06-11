import { faker } from '@faker-js/faker';
import { DateTime } from 'luxon';
import { type ID, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createLanguage } from './create-language';
import { createLocation } from './create-location';
import { createPerson } from './create-person';
import { createProject } from './create-project';
import { getUserFromSession } from './create-session';
import * as fragments from './fragments';
import { runAsAdmin } from './login';

export async function createLanguageEngagement(
  app: TestApp,
  input: Partial<InputOf<typeof UpdateLangEngDoc>> = {},
) {
  const now = DateTime.now().toISO();

  const result = await app.graphql.mutate(UpdateLangEngDoc, {
    input: {
      languageId:
        input.languageId ??
        (await runAsAdmin(app, async () => {
          return (await createLanguage(app)).id;
        })),
      projectId: input.projectId ?? (await createProject(app)).id,
      lukePartnership: true,
      disbursementCompleteDate: now,
      startDateOverride: now,
      endDateOverride: now,
      completeDate: now,
      paratextRegistryId: faker.lorem.word(),
      ...input,
    },
  });

  const actual = result.createLanguageEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);
  expect(actual.modifiedAt).toBeTruthy();
  return actual;
}
const UpdateLangEngDoc = graphql(
  `
    mutation createLanguageEngagement($input: CreateLanguageEngagement!) {
      createLanguageEngagement(input: { engagement: $input }) {
        engagement {
          ...languageEngagement
        }
      }
    }
  `,
  [fragments.languageEngagement],
);

export async function createInternshipEngagement(
  app: TestApp,
  input: Partial<InputOf<typeof UpdateInternshipEngDoc>> = {},
) {
  const currentUserId = (await getUserFromSession(app)).id;
  const now = DateTime.now().toISO();

  return await createInternshipEngagementWithMinimumValues(app, {
    countryOfOriginId:
      input.countryOfOriginId ||
      (await runAsAdmin(app, async () => {
        return (await createLocation(app)).id;
      })),
    mentorId: input.mentorId || currentUserId || (await createPerson(app)).id,
    position: 'Administration',
    methodologies: ['Film'],
    disbursementCompleteDate: now,
    startDateOverride: now,
    endDateOverride: now,
    completeDate: now,
    ...input,
  });
}

export async function createInternshipEngagementWithMinimumValues(
  app: TestApp,
  input: Partial<InputOf<typeof UpdateInternshipEngDoc>> = {},
) {
  const currentUserId = (await getUserFromSession(app)).id;
  const projectId = input.projectId || (await createProject(app)).id;
  const internId = input.internId || currentUserId || (await createPerson(app)).id;

  const result = await app.graphql.mutate(UpdateInternshipEngDoc, {
    input: {
      ...input,
      projectId,
      internId,
    },
  });

  const actual = result.createInternshipEngagement.engagement;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
const UpdateInternshipEngDoc = graphql(
  `
    mutation createInternshipEngagement($input: CreateInternshipEngagement!) {
      createInternshipEngagement(input: { engagement: $input }) {
        engagement {
          ...internshipEngagement
        }
      }
    }
  `,
  [fragments.internshipEngagement],
);

export async function getCurrentEngagementStatus(app: TestApp, id: ID) {
  const result = await app.graphql.query(EngStatusDoc, { id });
  expect(result).toBeTruthy();
  return result.engagement;
}
const EngStatusDoc = graphql(`
  query EngStatus($id: ID!) {
    engagement(id: $id) {
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
`);
