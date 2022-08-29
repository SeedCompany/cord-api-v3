import { faker } from '@faker-js/faker';
import { gql } from 'apollo-server-core';
import { generateId, isValidId } from '../../src/common';
import { CreatePerson, User } from '../../src/components/user';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createPerson(
  app: TestApp,
  input: Partial<CreatePerson> = {}
) {
  const person: CreatePerson = {
    email: faker.internet.email(),
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName() + (await generateId()),
    displayLastName: faker.name.lastName() + (await generateId()),
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
    }
  );

  const actual: User = result.createPerson.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
