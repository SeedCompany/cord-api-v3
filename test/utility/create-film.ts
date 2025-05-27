import { faker } from '@faker-js/faker';
import { graphql } from '~/graphql';
import { type CreateFilm, type Film } from '../../src/components/film/dto';
import { type TestApp } from './create-app';
import { fragments } from './fragments';

export async function createFilm(
  app: TestApp,
  input: Partial<CreateFilm> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(
    graphql(
      `
        mutation createFilm($input: CreateFilmInput!) {
          createFilm(input: $input) {
            film {
              ...film
            }
          }
        }
      `,
      [fragments.film],
    ),
    {
      input: {
        film: {
          ...input,
          name,
        },
      },
    },
  );
  const fm: Film = result.createFilm.film;

  expect(fm).toBeTruthy();

  return fm;
}
