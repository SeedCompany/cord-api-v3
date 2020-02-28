import * as faker from 'faker';

import {
  TestApp,
  createEducation,
  createSession,
  createTestApp,
  createUser,
} from './utility';

import { Education } from '../src/components/user/education';
import { User } from '../src/components/user';
import { fragments } from './utility/fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('Education e2e', () => {
  let app: TestApp;
  let user: User;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    user = await createUser(app);
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

    try {
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
        },
      );

      expect(actual.id).toBe(education.id);
      expect(isValid(actual.id)).toBe(true);
      expect(actual.institution).toEqual(education.institution);
    } catch (e) {
      console.error(e);
      fail();
    }
  });

  // UPDATE EDUCATION
  it('update education', async () => {
    const education = await createEducation(app, { userId: user.id });
    const newInstitution = faker.company.companyName();

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
      },
    );
    const updated = result.updateEducation.education;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(education.id);
    expect(updated.institution.value).toBe(newInstitution);
  });

  // DELETE EDUCATION
  it('delete education', async () => {
    const education = await createEducation(app, { userId: user.id });

    try {
      const result = await app.graphql.mutate(
        gql`
          mutation deleteEducation($id: ID!) {
            deleteEducation(id: $id)
          }
        `,
        {
          id: education.id,
        },
      );
      const actual: Education | undefined = result.deleteEducation;
      expect(actual).toBeTruthy();
    } catch (e) {
      console.log(e);
      fail();
    }
  });

  // LIST Educations
  it('List view of educations', async () => {
    // create a bunch of educations
    const numEducations = 10;
    await Promise.all(
      times(numEducations).map(() =>
        createEducation(app, { userId: user.id }),
      ),
    );
    // test reading new lang
    const { educations } = await app.graphql.query(gql`
      query {
        educations (input: { filter: { userId : "${user.id}" }}) {
          items {
            ...education
          }
          hasMore
          total
        }
      }
      ${fragments.education}
    `,
    );

    expect(educations.items.length).toBeGreaterThanOrEqual(numEducations);
  });
});
