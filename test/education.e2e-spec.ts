import * as faker from 'faker';

import {
  TestApp,
  createEducation,
  createSession,
  createTestApp,
  createUser,
  fragments,
} from './utility';

import { Education } from '../src/components/user/education';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('Education e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
  });
  afterAll(async () => {
    await app.close();
  });

  // READ EDUCATION
  it('create & read education by id', async () => {
    const user = await createUser(app);
    const ed = await createEducation(app, user.id);

    const result = await app.graphql.query(
      gql`
        query education($id: ID!) {
          education(id: $id) {
            ...education
          }
        }
        ${fragments.education}
      `,
      {
        id: ed.id,
      },
    );
    const actual: Education | undefined = result.education;
    expect(actual.institution.value).toBe(ed.institution.value);
  });

  // UPDATE EDUCATION
  it('update education', async () => {
    const user = await createUser(app);
    const education = await createEducation(app, user.id);
    const newInstitution = education.institution.value + ' updated';

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
    const updated = result?.updateEducation?.education;
    expect(updated).toBeTruthy();
    expect(updated.institution.value).toBe(newInstitution);
  });

  // DELETE EDUCATION
  it('delete education', async () => {
    const user = await createUser(app);
    const education = await createEducation(app, user.id);
    expect(education.id).toBeTruthy();
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
    try {
      await app.graphql.query(
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
    } catch (e) {
      expect(e.response.statusCode).toBe(404);
    }
  });

  // LIST EDUCATIONS
  //   it('list view of educations', async () => {
  //     // create a bunch of educations
  //     const educations = await Promise.all(
  //       times(10).map(() => createEducation(app)),
  //     );

  //     const { educations } = await app.graphql.query(gql`
  //       query {
  //         educations {
  //           items {
  //             ...education
  //           }
  //           hasMore
  //           total
  //         }
  //       }
  //       ${fragments.education}
  //     `);

  //     expect(educations.items).toHaveLength(educations.length);
  //   });
});
