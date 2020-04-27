import { gql } from 'apollo-server-core';
import { Directory } from '../../src/components/file';
import { TestApp } from './create-app';

export async function createDirectory(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      mutation createDirectory($name: String!) {
        createDirectory(name: $name) {
          id
          name
        }
      }
    `,
    {
      name: 'testdir',
    }
  );

  const actual: Directory = result.createDirectory;
  expect(actual).toBeTruthy();

  expect(actual.name.valueOf()).toBe('testdir');

  return actual;
}
