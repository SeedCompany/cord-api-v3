import { faker } from '@faker-js/faker';
import { gql } from 'apollo-server-core';
import { CreateFilm, Film } from '../../src/components/film';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function listFilms(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        films(input: {}) {
          items {
            ...film
          }
        }
      }
      ${fragments.film}
    `
  );
  const films = result.films.items;
  expect(films).toBeTruthy();
  return films;
}

export async function readOneFilm(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query readOneFilm($id: ID!) {
        film(id: $id) {
          ...film
        }
      }
      ${fragments.film}
    `,
    { id }
  );
  const actual = result.film;
  expect(actual).toBeTruthy();
  return actual;
}

export async function createFilm(
  app: TestApp,
  input: Partial<CreateFilm> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

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
