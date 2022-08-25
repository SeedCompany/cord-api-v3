import { faker } from '@faker-js/faker';
import { gql } from 'graphql-tag';
import { times } from 'lodash';
import { isValidId } from '../src/common';
import { Role } from '../src/components/authorization';
import { ScriptureRange } from '../src/components/scripture/dto';
import { Song } from '../src/components/song/dto';
import {
  createSession,
  createSong,
  createTestApp,
  fragments,
  registerUser,
  TestApp,
} from './utility';

describe('Song e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
  });

  afterAll(async () => {
    await app.close();
  });

  // Create SONG
  it('Create Song', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const song = await createSong(app, { name, scriptureReferences });
    expect(song.scriptureReferences.value).toBeDefined();
    expect(song.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences)
    );
  });

  // READ SONG
  it('create & read song by id', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const song = await createSong(app, { name, scriptureReferences });

    const { song: actual } = await app.graphql.query(
      gql`
        query st($id: ID!) {
          song(id: $id) {
            ...song
          }
        }
        ${fragments.song}
      `,
      {
        id: song.id,
      }
    );
    expect(actual.id).toBe(song.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(song.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(song.scriptureReferences.value)
    );
  });

  // UPDATE SONG
  it('update song', async () => {
    const st = await createSong(app);
    const newName = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const result = await app.graphql.mutate(
      gql`
        mutation updateSong($input: UpdateSongInput!) {
          updateSong(input: $input) {
            song {
              ...song
            }
          }
        }
        ${fragments.song}
      `,
      {
        input: {
          song: {
            id: st.id,
            name: newName,
            scriptureReferences,
          },
        },
      }
    );
    const updated = result.updateSong.song;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
    expect(updated.scriptureReferences.value).toBeDefined();
    expect(updated.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences)
    );
  });

  // DELETE SONG
  it.skip('delete song', async () => {
    const st = await createSong(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteSong($id: ID!) {
          deleteSong(id: $id) {
            __typename
          }
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: Song | undefined = result.deleteSong;
    expect(actual).toBeTruthy();
  });

  it('list view of songs', async () => {
    const numSongs = 2;
    await Promise.all(times(numSongs).map(() => createSong(app)));

    const { songs } = await app.graphql.query(gql`
      query {
        songs(input: { count: 15 }) {
          items {
            ...song
          }
          hasMore
          total
        }
      }
      ${fragments.song}
    `);

    expect(songs.items.length).toBeGreaterThanOrEqual(numSongs);
  });
});
