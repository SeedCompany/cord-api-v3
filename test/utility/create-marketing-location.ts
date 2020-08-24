import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  CreateMarketingLocation,
  MarketingLocation,
} from '../../src/components/marketing-location';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createMarketingLocation(
  app: TestApp,
  input: Partial<CreateMarketingLocation> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();

  const result = await app.graphql.mutate(
    gql`
      mutation createMarketingLocation($input: CreateMarketingLocationInput!) {
        createMarketingLocation(input: $input) {
          marketingLocation {
            ...marketingLocation
          }
        }
      }
      ${fragments.marketingLocation}
    `,
    {
      input: {
        marketingLocation: {
          ...input,
          name,
        },
      },
    }
  );
  const st: MarketingLocation =
    result.createMarketingLocation.marketingLocation;

  expect(st).toBeTruthy();

  return st;
}
