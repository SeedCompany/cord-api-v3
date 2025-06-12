import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { isValidId } from '~/common';
import { graphql } from '~/graphql';
import {
  createApp,
  createTesterWithRole,
  type IdentifiedTester,
  type TestApp,
} from './setup';
import { createEducation, fragments } from './utility';

describe('Education e2e', () => {
  let app: TestApp;
  let user: IdentifiedTester;

  beforeAll(async () => {
    app = await createApp();
    user = await createTesterWithRole(app, 'FieldOperationsDirector');
  });

  it('create a education', async () => {
    const education = await createEducation(user.legacyApp, {
      user: user.identity.id,
    });
    expect(education.id).toBeDefined();
  });

  it('read one education by id', async () => {
    const education = await createEducation(user.legacyApp, {
      user: user.identity.id,
    });

    const { education: actual } = await user.run(
      graphql(
        `
          query education($id: ID!) {
            education(id: $id) {
              ...education
            }
          }
        `,
        [fragments.education],
      ),
      {
        id: education.id,
      },
    );

    expect(actual.id).toBe(education.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.institution).toEqual(education.institution);
  });

  // UPDATE EDUCATION
  it('update education', async () => {
    const education = await createEducation(user.legacyApp, {
      user: user.identity.id,
    });
    const newInstitution = faker.company.name();

    const result = await user.run(
      graphql(
        `
          mutation updateEducation($input: UpdateEducation!) {
            updateEducation(input: $input) {
              education {
                ...education
              }
            }
          }
        `,
        [fragments.education],
      ),
      {
        input: {
          id: education.id,
          institution: newInstitution,
        },
      },
    );
    const updated = result.updateEducation.education;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(education.id);
    expect(updated.institution.value).toBe(newInstitution);
  });

  // DELETE EDUCATION
  it.skip('delete education', async () => {
    const education = await createEducation(user.legacyApp, {
      user: user.identity.id,
    });

    const result = await user.run(
      graphql(`
        mutation deleteEducation($id: ID!) {
          deleteEducation(id: $id) {
            __typename
          }
        }
      `),
      {
        id: education.id,
      },
    );
    const actual = result.deleteEducation;
    expect(actual).toBeTruthy();
  });

  // LIST Educations
  it('List view of educations', async () => {
    // create 2 educations
    const numEducations = 2;
    await Promise.all(
      times(numEducations).map(() =>
        createEducation(user.legacyApp, { user: user.identity.id }),
      ),
    );

    const result = await user.run(
      graphql(
        `
          query UserEducation($id: ID!) {
            user(id: $id) {
              education {
                items {
                  ...education
                }
                hasMore
                total
              }
            }
          }
        `,
        [fragments.education],
      ),
      {
        id: user.identity.id,
      },
    );

    expect(result.user.education.items.length).toBeGreaterThanOrEqual(
      numEducations,
    );
  });
});
