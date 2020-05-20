import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { CreateFileInput, File } from '../../src/components/file/dto';
import { TestApp } from './create-app';

export async function createFile(
  app: TestApp,
  input: Partial<CreateFileInput> = {}
) {
  const file: CreateFileInput = {
    uploadId: input.uploadId!,
    parentId: input.parentId!,
    name: faker.system.fileName(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createFile($input: CreateFileInput!) {
        createFile(input: $input) {
          id
          name
        }
      }
    `,
    {
      input: file,
    }
  );

  const actual: File = result.createFile;
  expect(actual.name).toBe(file.name);

  return actual;
}
