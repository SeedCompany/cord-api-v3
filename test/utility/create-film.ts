import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { CreateFilm, Film } from '../../src/components/product/film';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createFilm(
  app: TestApp,
  input: Partial<CreateFilm> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();
  const rangeStart = input.range?.rangeStart || faker.random.number();
  const rangeEnd = input.range?.rangeEnd || faker.random.number();

  const result = await app.graphql.mutate(
    gql`
      mutation createFilm($input: CreateFilmInput!) {
        createFilm(input: $input) {
          film {
            ...film
          }
        }
      }
      ${fragments.film}
    `,
    {
      input: {
        film: {
          ...input,
          name,
          range: {
            rangeStart: rangeStart,
            rangeEnd: rangeEnd,
          },
        },
      },
    }
  );
  const fm: Film = result.createFilm.film;

  expect(fm).toBeTruthy();

  return fm;
}
