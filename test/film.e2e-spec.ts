import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValidId } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { Film } from '../src/components/film/dto';
import { ScriptureRange } from '../src/components/scripture/dto';
import {
  createFilm,
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';

describe('Film e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(app, [Powers.CreateFilm]);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  // Create FILM
  it('Create Film', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = ScriptureRange.randomList();
    const film = await createFilm(app, { name, scriptureReferences });
    expect(film.scriptureReferences.value).toBeDefined();
    expect(film.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences)
    );
  });

  // READ FILM
  it('create & read film by id', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = ScriptureRange.randomList();
    const fm = await createFilm(app, { name, scriptureReferences });
    const { film: actual } = await app.graphql.query(
      gql`
        query fm($id: ID!) {
          film(id: $id) {
            ...film
          }
        }
        ${fragments.film}
      `,
      {
        id: fm.id,
      }
    );
    expect(actual.id).toBe(fm.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(fm.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(fm.scriptureReferences.value)
    );
  });

  // UPDATE FILM
  it('update film', async () => {
    const fm = await createFilm(app);
    const newName = faker.company.companyName();
    const scriptureReferences = ScriptureRange.randomList();
    const result = await app.graphql.mutate(
      gql`
        mutation updateFilm($input: UpdateFilmInput!) {
          updateFilm(input: $input) {
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
            id: fm.id,
            name: newName,
            scriptureReferences,
          },
        },
      }
    );
    const updated = result.updateFilm.film;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
    expect(updated.scriptureReferences.value).toBeDefined();
    expect(updated.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences)
    );
  });

  // DELETE FILM
  it.skip('delete film', async () => {
    const fm = await createFilm(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteFilm($id: ID!) {
          deleteFilm(id: $id) {
            __typename
          }
        }
      `,
      {
        id: fm.id,
      }
    );
    const actual: Film | undefined = result.deleteFilm;
    expect(actual).toBeTruthy();
  });

  it('list view of films', async () => {
    const numFilms = 2;
    await Promise.all(times(numFilms).map(() => createFilm(app)));

    const { films } = await app.graphql.query(gql`
      query {
        films(input: { count: 15 }) {
          items {
            ...film
          }
          hasMore
          total
        }
      }
      ${fragments.film}
    `);

    expect(films.items.length).toBeGreaterThanOrEqual(numFilms);
  });
});
