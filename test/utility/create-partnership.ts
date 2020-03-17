import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { CalendarDate } from '../../src/common';
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipType,
} from '../../src/components/partnership';
import { TestApp } from './create-app';
import { createOrganization } from './create-organization';
import { fragments } from './fragments';

export async function createPartnership(
  app: TestApp,
  input: Partial<CreatePartnership> = {}
) {
  const org = await createOrganization(app);
  const partnership: CreatePartnership = {
    agreementStatus: PartnershipAgreementStatus.AwaitingSignature,
    mouStatus: PartnershipAgreementStatus.AwaitingSignature,
    types: [PartnershipType.Managing],
    organizationId: org.id,
    mouStart: CalendarDate.local(),
    mouEnd: CalendarDate.local(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createPartnership($input: CreatePartnershipInput!) {
        createPartnership(input: $input) {
          partnership {
            ...partnership
          }
        }
      }
      ${fragments.partnership}
    `,
    {
      input: {
        partnership,
      },
    }
  );

  const actual: Partnership = result.createPartnership.partnership;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.agreementStatus.value).toBe(partnership.agreementStatus);
  expect(actual.mouStatus.value).toBe(partnership.mouStatus);
  expect(actual.types.value).toEqual(
    expect.arrayContaining(partnership.types!)
  );

  return actual;
}
