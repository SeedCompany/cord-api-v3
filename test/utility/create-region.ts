import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { createUser } from '.';
import { CreateRegion, Region } from '../../src/components/location';
import { TestApp } from './create-app';
import { createZone } from './create-zone';
import { fragments } from './fragments';

export async function createRegion(
  app: TestApp,
  input: Partial<CreateRegion> = {}
) {
  const region: CreateRegion = {
    name: faker.random.word() + ' Region',
    zoneId: input.zoneId ?? (await createZone(app)).id,
    directorId: input.directorId ?? (await createUser(app)).id,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createRegion($input: CreateRegionInput!) {
        createRegion(input: $input) {
          region {
            ...region
            zone {
              value {
                ...zone
              }
              canRead
              canEdit
            }
            director {
              value {
                ...user
              }
              canRead
              canEdit
            }
          }
        }
      }
      ${fragments.region}
      ${fragments.zone}
      ${fragments.user}
    `,
    {
      input: {
        region,
      },
    }
  );

  const actual: Region = result.createRegion.region;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(region.name);

  return actual;
}
