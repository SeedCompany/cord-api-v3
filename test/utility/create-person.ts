import { faker } from '@faker-js/faker';
import { generateId, isValidId } from '../../src/common';
import { CreatePerson } from '../../src/components/user';
import { TestApp } from './create-app';
import { fragments, RawUser } from './fragments';
import { gql } from './gql-tag';

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
    gql`
      mutation createPerson($input: CreatePersonInput!) {
        createPerson(input: $input) {
          user {
            ...user
          }
        }
      }
      ${fragments.user}
    `,
    {
      input: {
        person,
      },
    },
  );

  const actual: RawUser = result.createPerson.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
