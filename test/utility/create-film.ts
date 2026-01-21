import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createFilm(
  app: TestApp,
  input: Partial<InputOf<typeof CreateFilmDoc>> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(CreateFilmDoc, {
    input: {
      ...input,
      name,
    },
  });
  const fm = result.createFilm.film;

  expect(fm).toBeTruthy();

  return fm;
}

const CreateFilmDoc = graphql(
  `
    mutation createFilm($input: CreateFilm!) {
      createFilm(input: $input) {
        film {
          ...film
        }
      }
    }
  `,
  [fragments.film],
);
