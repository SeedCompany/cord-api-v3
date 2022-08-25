import { faker } from '@faker-js/faker';
import { gql } from 'graphql-tag';
import { CreateSong, Song } from '../../src/components/song';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createSong(
  app: TestApp,
  input: Partial<CreateSong> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(
    gql`
      mutation createSong($input: CreateSongInput!) {
        createSong(input: $input) {
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
          ...input,
          name,
        },
      },
    }
  );
  const st: Song = result.createSong.song;

  expect(st).toBeTruthy();

  return st;
}
