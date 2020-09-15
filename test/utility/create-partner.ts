import { gql } from 'apollo-server-core';
import { CreatePartner, Partner } from '../../src/components/partner';
import { TestApp } from './create-app';
import { createOrganization } from './create-organization';
import { createPerson } from './create-person';
import { fragments } from './fragments';

export async function createPartner(
  app: TestApp,
  input: Partial<CreatePartner> = {}
) {
  const organizationId =
    input.organizationId || (await createOrganization(app)).id;
  const pointOfContactId =
    input.pointOfContactId || (await createPerson(app)).id;

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
        partner: {
          ...input,
          organizationId,
          pointOfContactId,
        },
      },
    }
  );
  const partner: Partner = result.createPartner.partner;

  expect(partner).toBeTruthy();

  return partner;
}
