import { faker } from '@faker-js/faker';
import { times } from 'lodash';
import { isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createEducation,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  type TestApp,
} from './utility';

describe('Education e2e', () => {
  let app: TestApp;
  let user: fragments.user;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    user = await registerUser(app, { roles: [Role.FieldOperationsDirector] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a education', async () => {
    const education = await createEducation(app, { userId: user.id });
    expect(education.id).toBeDefined();
  });

  it('read one education by id', async () => {
    const education = await createEducation(app, { userId: user.id });

    const { education: actual } = await app.graphql.query(
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
    const education = await createEducation(app, { userId: user.id });
    const newInstitution = faker.company.name();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateEducation($input: UpdateEducationInput!) {
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
          education: {
            id: education.id,
            institution: newInstitution,
          },
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
    const education = await createEducation(app, { userId: user.id });

    const result = await app.graphql.mutate(
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
      times(numEducations).map(() => createEducation(app, { userId: user.id })),
    );

    const result = await app.graphql.query(
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
        id: user.id,
      },
    );

    expect(result.user.education.items.length).toBeGreaterThanOrEqual(
      numEducations,
    );
  });
});
