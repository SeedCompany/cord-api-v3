import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { createLocation } from '.';
import { ID } from '../../src/common';
import { SecuredLocationList } from '../../src/components/location';
import {
  CreateOrganization,
  Organization,
} from '../../src/components/organization';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function readOneOrgLocations(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query readOneOrgLocations($id: ID!) {
        organization(id: $id) {
          locations {
            canCreate
            canRead
            items {
              ...location
            }
          }
        }
      }
      ${fragments.location}
    `,
    { id }
  );
  const actual: SecuredLocationList = result.organization.locations;
  expect(actual).toBeTruthy();
  return actual.items;
}

export async function readOneOrganization(app: TestApp, id: ID) {
  const result = await app.graphql.query(
    gql`
      query readOneOrganization($id: ID!) {
        organization(id: $id) {
          ...org
        }
      }
      ${fragments.org}
    `,
    { id }
  );
  const actual: Organization = result.organization;
  expect(actual).toBeTruthy();
  return actual;
}

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
