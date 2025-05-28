import { faker } from '@faker-js/faker';
import { graphql } from '~/graphql';
import {
  type CreatePartner,
  PartnerType,
} from '../../src/components/partner/dto';
import { FinancialReportingType } from '../../src/components/partnership/dto';
import { type TestApp } from './create-app';
import { createOrganization } from './create-organization';
import { createPerson } from './create-person';
import * as fragments from './fragments';

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
    address: faker.location.city(),
    ...input,
  };

  const result = await app.graphql.mutate(
    graphql(
      `
        mutation createPartner($input: CreatePartnerInput!) {
          createPartner(input: $input) {
            partner {
              ...partner
            }
          }
        }
      `,
      [fragments.partner],
    ),
    {
      input: {
        partner: createPartner,
      },
    },
  );
  const partner = result.createPartner.partner;

  expect(partner).toBeTruthy();

  return partner;
}
