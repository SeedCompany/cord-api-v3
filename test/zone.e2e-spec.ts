import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { Zone } from '../src/components/location';
import { User } from '../src/components/user';
import { createSession, createTestApp, createUser, TestApp } from './utility';
import { createZone } from './utility/create-zone';
import { fragments } from './utility/fragments';

describe('Zone e2e', () => {
  let app: TestApp;
  let director: User;

  let newDirector: User;
  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await createUser(app);
    newDirector = await createUser(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create a zone', async () => {
    const zone = await createZone(app, { directorId: director.id });
    expect(zone.id).toBeDefined();
  });

  it('read one zone by id', async () => {
    const zone = await createZone(app, { directorId: director.id });

    try {
      const { location: actual } = await app.graphql.query(
        gql`
          query zone($id: ID!) {
            location(id: $id) {
              __typename
              ... on Zone {
                ...zone
                director {
                  value {
                    ...user
                  }
                  canEdit
                  canRead
                }
              }
            }
          }

          ${fragments.zone}
          ${fragments.user}
        `,
        {
          id: zone.id,
        }
      );

      expect(actual.id).toBe(zone.id);
      expect(isValid(actual.id)).toBe(true);
      expect(actual.name).toEqual(zone.name);
    } catch (e) {
      console.error(e);
      fail();
    }
  });

  it('update zone', async () => {
    const zone = await createZone(app, { directorId: director.id });
    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateZone($input: UpdateZoneInput!) {
          updateZone(input: $input) {
            zone {
              ...zone
            }
          }
        }
        ${fragments.zone}
      `,
      {
        input: {
          zone: {
            id: zone.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateZone.zone;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(zone.id);
    expect(updated.name.value).toBe(newName);
  });

  it("update zone's director", async () => {
    const zone = await createZone(app, { directorId: director.id });

    const result = await app.graphql.mutate(
      gql`
        mutation updateZone($input: UpdateZoneInput!) {
          updateZone(input: $input) {
            zone {
              ...zone
              director {
                value {
                  ...user
                }
              }
            }
          }
        }
        ${fragments.zone}
        ${fragments.user}
      `,
      {
        input: {
          zone: {
            id: zone.id,
            directorId: newDirector.id,
          },
        },
      }
    );
    const updated = result.updateZone.zone;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(zone.id);
    expect(updated.director.value.id).toBe(newDirector.id);
  });

  it('delete zone', async () => {
    const zone = await createZone(app, { directorId: director.id });

    try {
      const result = await app.graphql.mutate(
        gql`
          mutation deleteLocation($id: ID!) {
            deleteLocation(id: $id)
          }
        `,
        {
          id: zone.id,
        }
      );
      const actual: Zone | undefined = result.deleteLocation;

      expect(actual).toBeTruthy();
    } catch (e) {
      console.log(e);
      fail();
    }
  });

  it.skip('returns a list of zones', async () => {
    // create 2 zones
    await Promise.all(
      ['Asia1', 'Asia2'].map(e =>
        createZone(app, { name: e, directorId: director.id })
      )
    );

    const { locations } = await app.graphql.query(gql`
      query {
        locations(input: { filter: { name: "Asia", types: ["zone"] } }) {
          items {
            ...zone
          }
          hasMore
          total
        }
      }
      ${fragments.zone}
    `);

    expect(locations.items.length).toBeGreaterThanOrEqual(2);
  });
});
