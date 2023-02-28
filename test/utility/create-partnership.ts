import { CalendarDate, ID, isValidId } from '../../src/common';
import { PartnerType } from '../../src/components/partner';
import {
  CreatePartnership,
  FinancialReportingType,
  Partnership,
  PartnershipAgreementStatus,
} from '../../src/components/partnership';
import { TestApp } from './create-app';
import { createPartner } from './create-partner';
import { createProject } from './create-project';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function listPartnerships(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        partnerships(input: {}) {
          items {
            ...partnership
          }
        }
      }
      ${fragments.partnership}
    `,
  );
  const partnerships = result.partnerships.items;
  expect(partnerships).toBeTruthy();
  return partnerships;
}

export async function readOnePartnership(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadOnePartnership($id: ID!) {
        partnership(id: $id) {
          ...partnership
        }
      }
      ${fragments.partnership}
    `,
    { id },
  );
  const actual = result.partnership;
  expect(actual).toBeTruthy();
  return actual;
}
export async function createPartnership(
  app: TestApp,
  { changeset, ...input }: Partial<CreatePartnership> & { changeset?: ID } = {},
) {
  const partnership: CreatePartnership = {
    projectId: input.projectId || (await createProject(app)).id,
    agreementStatus: PartnershipAgreementStatus.AwaitingSignature,
    mouStatus: PartnershipAgreementStatus.AwaitingSignature,
    types: [PartnerType.Managing],
    financialReportingType: FinancialReportingType.Funded,
    partnerId: input.partnerId || (await createPartner(app)).id,
    mouStartOverride: CalendarDate.local(),
    mouEndOverride: CalendarDate.local(),
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
        changeset,
      },
    },
  );

  const actual: Partnership = result.createPartnership.partnership;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.agreementStatus.value).toBe(partnership.agreementStatus);
  expect(actual.mouStatus.value).toBe(partnership.mouStatus);
  expect(actual.types.value).toEqual(
    expect.arrayContaining(partnership.types!),
  );

  return actual;
}
