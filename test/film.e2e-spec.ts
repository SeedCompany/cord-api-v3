import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { Film } from '../src/components/product/film';
import {
  createFilm,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('Film e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // Create FILM
  it('Create Film', async () => {
    const name = faker.company.companyName();
    await createFilm(app, { name });
  });

  // // READ FILM
  // it.skip('create & read film by id', async () => {
  //   const fm = await createFilm(app);

  //   const { film: actual } = await app.graphql.query(
  //     gql`
  //       query fm($id: ID!) {
  //         film(id: $id) {
  //           ...film
  //         }
  //       }
  //       ${fragments.film}
  //     `,
  //     {
  //       id: fm.id,
  //     }
  //   );

  //   expect(actual.id).toBe(fm.id);
  //   expect(isValid(actual.id)).toBe(true);
  //   expect(actual.name.value).toBe(fm.name.value);
  // });

  // // UPDATE FILM
  // it.skip('update film', async () => {
  //   const fm = await createFilm(app);

  //   const newName = faker.company.companyName();

  //   const result = await app.graphql.mutate(
  //     gql`
  //       mutation updateFilm($input: UpdateFilmInput!) {
  //         updateFilm(input: $input) {
  //           film {
  //             ...film
  //           }
  //         }
  //       }
  //       ${fragments.film}
  //     `,
  //     {
  //       input: {
  //         film: {
  //           id: fm.id,
  //           name: newName,
  //           range: {
  //             rangeStart: 23,
  //             rangeEnd: 45,
  //           },
  //         },
  //       },
  //     }
  //   );

  //   const updated = result.updateFilm.film;
  //   expect(updated).toBeTruthy();
  //   // expect(updated.id).toBe(fm.id);
  //   expect(updated.name.value).toBe(newName);
  // });

  // // DELETE FILM
  // it.skip('delete film', async () => {
  //   const fm = await createFilm(app);
  //   const result = await app.graphql.mutate(
  //     gql`
  //       mutation deleteFilm($id: ID!) {
  //         deleteFilm(id: $id)
  //       }
  //     `,
  //     {
  //       id: fm.id,
  //     }
  //   );
  //   const actual: Film | undefined = result.deleteFilm;
  //   expect(actual).toBeTruthy();
  // });

  // // LIST FILMs
  // it.skip('list view of films', async () => {
  //   // create a bunch of films
  //   await Promise.all(
  //     times(10).map(() => createFilm(app, { name: generate() + ' Inc' }))
  //   );

  //   const { films } = await app.graphql.query(gql`
  //     query {
  //       films(input: { filter: { name: "Inc" } }) {
  //         items {
  //           ...film
  //         }
  //         hasMore
  //         total
  //       }
  //     }
  //     ${fragments.film}
  //   `);

  //   expect(films.items.length).toBeGreaterThan(9);
  // });
});
