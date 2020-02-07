import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import {
  createEducation,
  createTestApp,
  createToken,
  createUser,
  fragments,
  TestApp,
} from './utility';
import { times } from 'lodash';
import * as faker from 'faker';
import { Education } from '../src/components/user/education';

describe('Education e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
    await createToken(app);
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
        query educt($id: ID!) {
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
    const educt = await createEducation(app, user.id);
    const newInstitution = educt.institution.value + ' updated';

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
            id: educt.id,
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
    const educt = await createEducation(app, user.id);

    const result = await app.graphql.mutate(
      gql`
        mutation deleteEducation($id: ID!) {
          deleteEducation(id: $id)
        }
      `,
      {
        id: educt.id,
      },
    );
    const actual: Education | undefined = result.deleteEducation;
    expect(actual).toBeTruthy();
  });

  // LIST EDUCATIONS
  //   it('list view of educations', async () => {
  //     // create a bunch of educations
  //     const educts = await Promise.all(
  //       times(10).map(() => createEducation(app)),
  //     );

  //     const { educations } = await app.graphql.query(gql`
  //       query {
  //         educations {
  //           items {
  //             ...educt
  //           }
  //           hasMore
  //           total
  //         }
  //       }
  //       ${fragments.educt}
  //     `);

  //     expect(educations.items).toHaveLength(educts.length);
  //   });
});
