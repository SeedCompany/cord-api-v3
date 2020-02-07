import { gql } from 'apollo-server-core';
import {
  CreateOrganization,
  Organization,
} from '../../src/components/organization';
import { TestApp } from './create-app';
import * as faker from 'faker';
import { fragments } from './fragments';

export async function createOrganization(
  app: TestApp,
  input: Partial<CreateOrganization> = {},
) {
  const name = input.name || faker.company.companyName();

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
        },
      },
    },
  );
  const org: Organization | undefined = result.createOrganization?.organization;

  expect(org).toBeTruthy();

  return org;
}
