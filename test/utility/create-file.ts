import { gql } from 'apollo-server-core';
import { CreateFileInput } from '../../src/components/file/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createFile(
  app: TestApp,
  input: Partial<CreateFileInput> = {},
) {
  const file: Partial<CreateFileInput> = {
    ...input,
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
    },
  );

  const actual: File | undefined = result.createFile?.file;
  expect(actual).toBeTruthy();

  expect(actual.name.valueOf()).toBe(file.name);

  return actual;
}
