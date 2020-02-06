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

describe.skip('Education e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
    await createToken(app);
    await createUser(app);
  });
  afterEach(async () => {
    await app.close();
  });

  // READ EDUCATION
  it('create & read education by id', async () => {
    const educt = await createEducation(app);

    const { education: actual } = await app.graphql.query(
      gql`
        query educt($id: ID!) {
          education(id: $id) {
            ...educt
          }
        }
        ${fragments.educt}
      `,
      {
        id: educt.id,
      },
    );

    expect(actual.id).toBe(educt.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.institution.value).toBe(educt.institution);
  });

  // UPDATE EDUCATION
  it('update education', async () => {
    const educt = await createEducation(app);
    const newInstitution = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateEducation($input: UpdateEducationInput!) {
          updateEducation(input: $input) {
            education {
              ...educt
            }
          }
        }
        ${fragments.educt}
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
    expect(updated.id).toBe(educt.id);
    expect(updated.institution.value).toBe(newInstitution);
  });

  // DELETE EDUCATION
  it('delete education', async () => {
    const educt = await createEducation(app);

    await app.graphql.mutate(
      gql`
        mutation deleteEducation($id: ID!) {
          deleteEducation(id: $id)
        }
      `,
      {
        id: educt.id,
      },
    );
  });

  // LIST EDUCATIONS
  it('list view of educations', async () => {
    // create a bunch of educations
    const educts = await Promise.all(
      times(10).map(() => createEducation(app)),
    );

    const { educations } = await app.graphql.query(gql`
      query {
        educations {
          items {
            ...educt
          }
          hasMore
          total
        }
      }
      ${fragments.educt}
    `);

    expect(educations.items).toHaveLength(educts.length);
  });
});
