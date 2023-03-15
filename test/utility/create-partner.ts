import { faker } from '@faker-js/faker';
import {
  CreatePartner,
  Partner,
  PartnerType,
} from '../../src/components/partner';
import { FinancialReportingType } from '../../src/components/partnership';
import { TestApp } from './create-app';
import { createOrganization } from './create-organization';
import { createPerson } from './create-person';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function readOnePartner(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadOnePartner($id: ID!) {
        partner(id: $id) {
          ...partner
        }
      }
      ${fragments.partner}
    `,
    { id },
  );
  const actual = result.partner;
  expect(actual).toBeTruthy();
  return actual;
}

export async function listPartners(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        partners(input: {}) {
          items {
            ...partner
          }
        }
      }
      ${fragments.partner}
    `,
  );
  const partners = result.partners.items;
  expect(partners).toBeTruthy();
  return partners;
}
export async function createPartner(
  app: TestApp,
  input: Partial<CreatePartner> = {},
) {
  const createPartner: CreatePartner = {
    organizationId: input.organizationId || (await createOrganization(app)).id,
    pointOfContactId: input.pointOfContactId || (await createPerson(app)).id,
    types: [PartnerType.Managing],
    financialReportingTypes: [FinancialReportingType.Funded],
    pmcEntityCode: faker.helpers.replaceSymbols('???').toUpperCase(),
    globalInnovationsClient: false,
    active: false,
    address: faker.address.city(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createPartner($input: CreatePartnerInput!) {
        createPartner(input: $input) {
          partner {
            ...partner
          }
        }
      }
      ${fragments.partner}
    `,
    {
      input: {
        partner: createPartner,
      },
    },
  );
  const partner: Partner = result.createPartner.partner;

  expect(partner).toBeTruthy();

  return partner;
}
