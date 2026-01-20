import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { startCase } from 'lodash';
import { type ID } from '~/common';
import { graphql } from '~/graphql';
import { type TestApp } from './create-app';
import { fileNode } from './fragments';

export async function createDirectory(app: TestApp, parent: ID, name?: string) {
  const input = {
    parent,
    name: name ?? startCase(faker.lorem.words()),
  };

  const result = await app.graphql.mutate(CreateDirectoryDoc, {
    input,
  });

  const actual = result.createDirectory;
  expect(actual).toBeTruthy();
  expect(actual.name).toBe(input.name);

  return actual;
}

const CreateDirectoryDoc = graphql(
  `
    mutation createDirectory($input: CreateDirectory!) {
      createDirectory(input: $input) {
        ...fileNode
      }
    }
  `,
  [fileNode],
);
