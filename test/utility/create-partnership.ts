import { expect } from '@jest/globals';
import { CalendarDate, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createPartner } from './create-partner';
import { createProject } from './create-project';
import * as fragments from './fragments';

export async function createPartnership(
  app: TestApp,
  input: Partial<InputOf<typeof CreatePartnershipDoc>> = {},
) {
  const partnership = {
    project: input.project || (await createProject(app)).id,
    agreementStatus: 'AwaitingSignature',
    mouStatus: 'AwaitingSignature',
    types: ['Managing'],
    financialReportingType: 'Funded',
    partner: input.partner || (await createPartner(app)).id,
    mouStartOverride: CalendarDate.local().toISO(),
    mouEndOverride: CalendarDate.local().toISO(),
    ...input,
  } satisfies InputOf<typeof CreatePartnershipDoc>;

  const result = await app.graphql.mutate(CreatePartnershipDoc, {
    input: partnership,
  });

  const actual = result.createPartnership.partnership;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.agreementStatus.value).toBe(partnership.agreementStatus);
  expect(actual.mouStatus.value).toBe(partnership.mouStatus);
  expect(actual.types.value).toEqual(
    expect.arrayContaining(partnership.types!),
  );

  return actual;
}

const CreatePartnershipDoc = graphql(
  `
    mutation createPartnership($input: CreatePartnership!) {
      createPartnership(input: $input) {
        partnership {
          ...partnership
        }
      }
    }
  `,
  [fragments.partnership],
);
