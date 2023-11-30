import { faker } from '@faker-js/faker';
import {
  CreateOrganization,
  Organization,
} from '../../src/components/organization';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';
import { Raw } from './raw.type';

export async function createOrganization(
  app: TestApp,
  input: Partial<CreateOrganization> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const address = input.address || faker.location.city();

  const result = await app.graphql.mutate(
    gql`
      mutation createOrganization($input: CreateOrganizationInput!) {
        createOrganization(input: $input) {
          organization {
            ...org
          }
        }
      }
      ${fragments.org}
    `,
    {
      input: {
        organization: {
          ...input,
          name,
          address,
        },
      },
    },
  );
  const org: Raw<Organization> = result.createOrganization.organization;

  expect(org).toBeTruthy();

  return org;
}
