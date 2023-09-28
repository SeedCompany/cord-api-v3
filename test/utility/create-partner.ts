import { faker } from '@faker-js/faker';
import { IdOf } from '~/common';
import { Language } from '../../src/components/language';
import {
  CreatePartner,
  Partner,
  PartnerType,
} from '../../src/components/partner';
import { FinancialReportingType } from '../../src/components/partnership';
import { TestApp } from './create-app';
import { createLanguage } from './create-language';
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
    languagesOfConsulting: [(await createLanguage(app)).id as IdOf<Language>],
    types: [PartnerType.Managing],
    financialReportingTypes: [FinancialReportingType.Funded],
    pmcEntityCode: faker.helpers.replaceSymbols('???').toUpperCase(),
    globalInnovationsClient: false,
    active: false,
    address: faker.location.city(),
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
