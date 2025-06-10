import { faker } from '@faker-js/faker';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createOrganization(
  app: TestApp,
  input: Partial<InputOf<typeof CreateOrganizationDoc>> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const address = input.address || faker.location.city();

  const result = await app.graphql.mutate(CreateOrganizationDoc, {
    input: {
      ...input,
      name,
      address,
    },
  });
  const org = result.createOrganization.organization;

  expect(org).toBeTruthy();

  return org;
}

const CreateOrganizationDoc = graphql(
  `
    mutation createOrganization($input: CreateOrganization!) {
      createOrganization(input: { organization: $input }) {
        organization {
          ...org
        }
      }
    }
  `,
  [fragments.org],
);
