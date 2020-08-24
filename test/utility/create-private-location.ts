import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  CreatePrivateLocation,
  PrivateLocation,
  PrivateLocationType,
} from '../../src/components/location';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createPrivateLocation(
  app: TestApp,
  input: Partial<CreatePrivateLocation> = {}
) {
  const privateLocation: CreatePrivateLocation = {
    name: faker.hacker.noun() + faker.company.companyName(),
    publicName: faker.hacker.noun() + faker.company.companyName(),
    type: PrivateLocationType.State,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createPrivateLocation($input: CreatePrivateLocationInput!) {
        createPrivateLocation(input: $input) {
          privateLocation {
            ...privateLocation
          }
        }
      }
      ${fragments.privateLocation}
    `,
    {
      input: {
        privateLocation,
      },
    }
  );
  const st: PrivateLocation = result.createPrivateLocation.privateLocation;

  expect(st).toBeTruthy();

  return st;
}
