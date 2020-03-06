import { gql } from 'apollo-server-core';
import { CreateFileInput, File } from '../../src/components/file/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { generate } from 'shortid';

export async function createFile(
  app: TestApp,
  input: Partial<CreateFileInput> = {},
) {
  const file: CreateFileInput = {
    uploadId: generate(),
    parentId: 'test-parent',
    name: 'test-file',
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

  const actual: File = result.createFile.file;
  expect(actual).toBeTruthy();

  expect(actual.name.valueOf()).toBe(file.name);

  return actual;
}
