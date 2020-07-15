import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { CreateFilm, Film } from '../../src/components/film';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createFilm(
  app: TestApp,
  input: Partial<CreateFilm> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();

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
        },
      },
    }
  );
  const fm: Film = result.createFilm.film;

  expect(fm).toBeTruthy();

  return fm;
}
