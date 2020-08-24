import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generate } from 'shortid';
import {
  CreateRegistryOfGeography,
  RegistryOfGeography,
} from '../../src/components/registry-of-geography';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createRegistryOfGeography(
  app: TestApp,
  input: Partial<CreateRegistryOfGeography> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();
  const registryId = input.registryId || generate();

  const result = await app.graphql.mutate(
    gql`
      mutation createRegistryOfGeography(
        $input: CreateRegistryOfGeographyInput!
      ) {
        createRegistryOfGeography(input: $input) {
          registryOfGeography {
            ...registryOfGeography
          }
        }
      }
      ${fragments.registryOfGeography}
    `,
    {
      input: {
        registryOfGeography: {
          ...input,
          name,
          registryId,
        },
      },
    }
  );
  const st: RegistryOfGeography =
    result.createRegistryOfGeography.registryOfGeography;

  expect(st).toBeTruthy();

  return st;
}
