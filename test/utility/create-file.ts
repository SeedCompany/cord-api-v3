import { gql } from 'apollo-server-core';
import { generate } from 'shortid';
import { CreateFileInput, File } from '../../src/components/file/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createFile(
  app: TestApp,
  _input: Partial<CreateFileInput> = {}
) {
  const file: Partial<CreateFileInput> = {
    ..._input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createFile($input: CreateFileInput!) {
        createFile(input: $input) {
          file {
            ...file
          }
        }
      }
      ${fragments.file}
    `,
    {
      input: {
        file,
      },
    }
  );

  const actual: File = result.createFile.file;
  expect(actual).toBeTruthy();

  expect(actual.name.valueOf()).toBe(file.name);

  return actual;
}
