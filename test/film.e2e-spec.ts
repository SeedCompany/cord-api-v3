import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { Film } from '../src/components/film/dto';
import { createRandomScriptureReferences } from '../src/components/scripture/reference';
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
    const scriptureReferences = createRandomScriptureReferences();
    const film = await createFilm(app, { name, scriptureReferences });
    expect(film.scriptureReferences.value).toBeDefined();
    expect(film.scriptureReferences.value).toEqual(scriptureReferences);
  });

  // READ FILM
  it('create & read film by id', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
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
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(fm.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      fm.scriptureReferences.value
    );
  });

  // UPDATE FILM
  it('update film', async () => {
    const fm = await createFilm(app);
    const newName = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
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
    expect(updated.scriptureReferences.value).toEqual(scriptureReferences);
  });

  // DELETE FILM
  it('delete film', async () => {
    const fm = await createFilm(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteFilm($id: ID!) {
          deleteFilm(id: $id)
        }
      `,
      {
        id: fm.id,
      }
    );
    const actual: Film | undefined = result.deleteFilm;
    expect(actual).toBeTruthy();
  });

  // LIST FILMs
  it('list view of films', async () => {
    // create a bunch of films
    const numFilms = 2;
    await Promise.all(
      times(numFilms).map(() => createFilm(app, { name: generate() + ' Inc' }))
    );

    const { films } = await app.graphql.query(gql`
      query {
        films(input: { count: 15, filter: { name: "Inc" } }) {
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
