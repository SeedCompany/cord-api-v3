import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import { ScriptureRange } from '../src/components/scripture/dto';
import {
  createFilm,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  type TestApp,
} from './utility';

describe('Film e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.Consultant, Role.ProjectManager] });
  });

  // Create FILM
  it('Create Film', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const film = await createFilm(app, { name, scriptureReferences });
    expect(film.scriptureReferences.value).toBeDefined();
    expect(film.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences),
    );
  });

  // READ FILM
  it('create & read film by id', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const fm = await createFilm(app, { name, scriptureReferences });
    const { film: actual } = await app.graphql.query(
      graphql(
        `
          query fm($id: ID!) {
            film(id: $id) {
              ...film
            }
          }
        `,
        [fragments.film],
      ),
      {
        id: fm.id,
      },
    );
    expect(actual.id).toBe(fm.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(fm.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(fm.scriptureReferences.value),
    );
  });

  // UPDATE FILM
  it('update film', async () => {
    const fm = await createFilm(app);
    const newName = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateFilm($input: UpdateFilm!) {
            updateFilm(input: $input) {
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
          id: fm.id,
          name: newName,
          scriptureReferences,
        },
      },
    );
    const updated = result.updateFilm.film;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
    expect(updated.scriptureReferences.value).toBeDefined();
    expect(updated.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences),
    );
  });

  // DELETE FILM
  it.skip('delete film', async () => {
    const fm = await createFilm(app);
    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteFilm($id: ID!) {
          deleteFilm(id: $id) {
            __typename
          }
        }
      `),
      {
        id: fm.id,
      },
    );
    const actual = result.deleteFilm;
    expect(actual).toBeTruthy();
  });

  it('list view of films', async () => {
    const numFilms = 2;
    await Promise.all(times(numFilms).map(() => createFilm(app)));

    const { films } = await app.graphql.query(
      graphql(
        `
          query {
            films(input: { count: 15 }) {
              items {
                ...film
              }
              hasMore
              total
            }
          }
        `,
        [fragments.film],
      ),
    );

    expect(films.items.length).toBeGreaterThanOrEqual(numFilms);
  });
});
