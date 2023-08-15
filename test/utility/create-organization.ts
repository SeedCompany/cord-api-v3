import { faker } from '@faker-js/faker';
import {
  CreateOrganization,
  Organization,
} from '../../src/components/organization';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function createOrganization(
  app: TestApp,
  input: Partial<CreateOrganization> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const address = {
    addressOne: '1 Org Street',
    addressTwo: 'Suite 100',
    city: 'Arlington',
    state: 'TX',
    zip: '12345',
    country: 'US',
  };

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
          address: {
            ...address,
          },
        },
      },
    },
  );
  const org: Organization = result.createOrganization.organization;

  expect(org).toBeTruthy();

  return org;
}
