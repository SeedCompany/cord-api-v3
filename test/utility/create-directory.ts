import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { startCase } from 'lodash';
import { Directory } from '../../src/components/file';
import { TestApp } from './create-app';

export async function createDirectory(app: TestApp, name?: string) {
  name = name ?? startCase(faker.lorem.words());
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
      name,
    }
  );

  const actual: Directory = result.createDirectory;
  expect(actual).toBeTruthy();

  expect(actual.name).toBe(name);

  return actual;
}
