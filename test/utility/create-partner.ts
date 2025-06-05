import { faker } from '@faker-js/faker';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createOrganization } from './create-organization';
import { createPerson } from './create-person';
import * as fragments from './fragments';

export async function createPartner(
  app: TestApp,
  input: Partial<InputOf<typeof CreatePartnerDoc>> = {},
) {
  const result = await app.graphql.mutate(CreatePartnerDoc, {
    input: {
      types: ['Managing'],
      financialReportingTypes: ['Funded'],
      pmcEntityCode: faker.helpers.replaceSymbols('???').toUpperCase(),
      globalInnovationsClient: false,
      active: false,
      address: faker.location.city(),
      ...input,
      organizationId:
        input.organizationId || (await createOrganization(app)).id,
      pointOfContactId: input.pointOfContactId || (await createPerson(app)).id,
    },
  });
  const createdPartner = result.createPartner.partner;

  expect(createdPartner).toBeTruthy();

  return createdPartner;
}

const CreatePartnerDoc = graphql(
  `
    mutation createPartner($input: CreatePartner!) {
      createPartner(input: { partner: $input }) {
        partner {
          ...partner
        }
      }
    }
  `,
  [fragments.partner],
);
