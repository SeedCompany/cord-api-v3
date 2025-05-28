import { faker } from '@faker-js/faker';
import { generateId, isValidId } from '~/common';
import { graphql } from '~/graphql';
import { type CreatePerson } from '../../src/components/user/dto';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createPerson(
  app: TestApp,
  input: Partial<CreatePerson> = {},
  addDefaults = true,
) {
  const person: CreatePerson = !addDefaults
    ? (input as CreatePerson)
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

  const result = await app.graphql.mutate(
    graphql(
      `
        mutation createPerson($input: CreatePersonInput!) {
          createPerson(input: $input) {
            user {
              ...user
            }
          }
        }
      `,
      [fragments.user],
    ),
    {
      input: {
        person,
      },
    },
  );

  const actual = result.createPerson.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
