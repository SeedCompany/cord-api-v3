import { faker } from '@faker-js/faker';
import { Sensitivity } from '~/common';
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
    address: {
      addressOne: faker.location.streetAddress(),
      addressTwo: faker.location.buildingNumber(),
      city: faker.location.city(),
      state: faker.location.state(),
      zip: faker.location.zipCode(),
      country: faker.location.countryCode(),
      sensitivity: Sensitivity.Low,
    },
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
