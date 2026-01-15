import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { generateId, isValidId } from '~/common';
import { graphql, type InputOf, type ResultOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createPerson(
  app: TestApp,
  input: InputOf<typeof CreatePersonDoc>,
  addDefaults: false,
): Promise<ResultOf<typeof CreatePersonDoc>['createPerson']['user']>;
export async function createPerson(
  app: TestApp,
  input?: Partial<InputOf<typeof CreatePersonDoc>>,
): Promise<ResultOf<typeof CreatePersonDoc>['createPerson']['user']>;
export async function createPerson(
  app: TestApp,
  input: Partial<InputOf<typeof CreatePersonDoc>> = {},
  addDefaults = true,
) {
  const person = !addDefaults
    ? (input as InputOf<typeof CreatePersonDoc>)
    : {
        email: faker.internet.email(),
        realFirstName: faker.person.firstName(),
        realLastName: faker.person.lastName(),
        displayFirstName: faker.person.firstName() + (await generateId()),
        displayLastName: faker.person.lastName() + (await generateId()),
        phone: faker.phone.number(),
        timezone: 'America/Chicago',
        about: 'about detail' + (await generateId()),
        ...input,
      };

  const result = await app.graphql.mutate(CreatePersonDoc, {
    input: person,
  });

  const actual = result.createPerson.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

const CreatePersonDoc = graphql(
  `
    mutation createPerson($input: CreatePerson!) {
      createPerson(input: $input) {
        user {
          ...user
        }
      }
    }
  `,
  [fragments.user],
);
