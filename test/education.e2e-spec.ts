import { faker } from '@faker-js/faker';
import { gql } from 'graphql-tag';
import { times } from 'lodash';
import { isValidId } from '../src/common';
import { Role } from '../src/components/authorization/dto/role.dto';
import { User } from '../src/components/user';
import { Education } from '../src/components/user/education';
import {
  createEducation,
  createSession,
  createTestApp,
  registerUser,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';

describe('Education e2e', () => {
  let app: TestApp;
  let user: User;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    user = await registerUser(app, { roles: [Role.LeadFinancialAnalyst] });
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
      gql`
        query education($id: ID!) {
          education(id: $id) {
            ...education
          }
        }
        ${fragments.education}
      `,
      {
        id: education.id,
      }
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
      gql`
        mutation updateEducation($input: UpdateEducationInput!) {
          updateEducation(input: $input) {
            education {
              ...education
            }
          }
        }
        ${fragments.education}
      `,
      {
        input: {
          education: {
            id: education.id,
            institution: newInstitution,
          },
        },
      }
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
      gql`
        mutation deleteEducation($id: ID!) {
          deleteEducation(id: $id) {
            __typename
          }
        }
      `,
      {
        id: education.id,
      }
    );
    const actual: Education | undefined = result.deleteEducation;
    expect(actual).toBeTruthy();
  });

  // LIST Educations
  it('List view of educations', async () => {
    // create 2 educations
    const numEducations = 2;
    await Promise.all(
      times(numEducations).map(() => createEducation(app, { userId: user.id }))
    );

    const result = await app.graphql.query(
      gql`
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
        ${fragments.education}
      `,
      {
        id: user.id,
      }
    );

    expect(result.user.education.items.length).toBeGreaterThanOrEqual(
      numEducations
    );
  });
});
