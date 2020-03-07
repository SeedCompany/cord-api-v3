import * as faker from 'faker';

import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import {
  CreatePartnership,
  Partnership,
  PartnershipType,
  PartnershipAgreementStatus,
} from '../../src/components/partnership';
import { createOrganization } from './create-organization';
import { DateTime } from 'luxon';

export async function createPartnership(
  app: TestApp,
  input: Partial<CreatePartnership> = {},
) {
  const org = await createOrganization(app);
  const partnership: CreatePartnership = {
    agreementStatus: PartnershipAgreementStatus.AwaitingSignature,
    mouStatus: PartnershipAgreementStatus.AwaitingSignature,
    types: [PartnershipType.Managing],
    organizationId: org.id,
    mouStart: DateTime.local(),
    mouEnd: DateTime.local(),
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
    },
  );

  const actual: Partnership = result.createPartnership.partnership;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.agreementStatus.value).toBe(partnership.agreementStatus);
  expect(actual.mouStatus.value).toBe(partnership.mouStatus);
  expect(actual.types).toEqual(expect.arrayContaining(partnership.types));

  return actual;
}
