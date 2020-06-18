import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';
import { createPerson, getUserFromSession } from '.';
import { CreateZone, Zone } from '../../src/components/location';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createZone(
  app: TestApp,
  input: Partial<CreateZone> = {}
) {
  const zone: CreateZone = {
    name: 'Zone' + generate(),
    directorId:
      input.directorId ||
      (await getUserFromSession(app)).id ||
      (await createPerson(app)).id,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createZone($input: CreateZoneInput!) {
        createZone(input: $input) {
          zone {
            ...zone
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
      ${fragments.zone}
      ${fragments.user}
    `,
    {
      input: {
        zone,
      },
    }
  );

  const actual: Zone = result.createZone.zone;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(zone.name);

  return actual;
}
