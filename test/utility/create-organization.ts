import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  CreateOrganization,
  Organization,
} from '../../src/components/organization';
import { TestApp } from './create-app';
import { createLocation } from './create-location';
import { fragments } from './fragments';

export async function createOrganization(
  app: TestApp,
  input: Partial<CreateOrganization> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();
  const address = input.address || faker.address.city();

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
    }
  );
  const org: Organization = result.createOrganization.organization;

  expect(org).toBeTruthy();

  return org;
}

export async function addLocationToOrganization(
  app: TestApp,
  orgId?: string,
  locId?: string
) {
  const locationId = locId || (await createLocation(app)).id;
  const organizationId = orgId || (await createOrganization(app)).id;
  const result = await app.graphql.mutate(
    gql`
      mutation addLocationToOrganization(
        $organizationId: ID!
        $locationId: ID!
      ) {
        addLocationToOrganization(
          organizationId: $organizationId
          locationId: $locationId
        ) {
          ...org
        }
      }
      ${fragments.org}
    `,
    {
      organizationId: organizationId,
      locationId: locationId,
    }
  );
  expect(result.addLocationToOrganization.id).toEqual(organizationId);
  expect(result.addLocationToOrganization.locations.items[0].id).toEqual(
    locationId
  );
}
