import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { isValid } from 'shortid';
import { Location } from '../src/components/location';
import { createTestApp, TestApp } from './utility';

async function createLocation(app: INestApplication): Promise<Location> {
  const location = new Location();
  location.country = 'India';
  location.area = 'Hyd';
  location.editable = true;

  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createLocation (input: { location: { country: "${location.country}", area: "${location.area}", editable: ${location.editable}} }){
        location{
        id
        country
        area
        editable
        }
      }
    }
    `,
    })
    .expect(({ body }) => {
      location.id = body.data.createLocation.location.id;
      expect(isValid(location.id)).toBe(true);
      expect(body.data.createLocation.location.country).toBe(location.country);
    })
    .expect(200);
  return location;
}

describe('Location e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('read one location by id', async () => {
    const location = await createLocation(app);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readLocation ( input: { location: { id: "${location.id}" } }){
            location{
            id
            country
            area
            editable
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readLocation.location.id).toBe(location.id);
        expect(body.data.readLocation.location.country).toBe(location.country);
      })
      .expect(200);
  });

  it('list locations', async () => {
    const listLocations = [
      {
        country: 'India',
      },
    ];
    const location = await createLocation(app);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query{
          locations(input:{query:{filter:"",page:0,count:2,order:"DESC", sort:"country"}})
          {
            countries{
              country
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.locations.countries[0].country).toBe(
          listLocations[0].country,
        );
      })
      .expect(200);
  });

  it('update Location', async () => {
    const location = await createLocation(app);

    return await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
          mutation {
            updateLocation (
              input: {
                location: {
                  id: "${location.id}"
                  country: "${location.country}"
                  area: "${location.area}"
                  editable: ${location.editable}
                }
              }
              ) {
              location {
                id
                country
                area
                editable
              }
            }
          }
          `,
      })
      .expect(({ body }) => {
        expect(body.data.updateLocation.location.id).toBe(location.id);
        expect(body.data.updateLocation.location.country).toBe(
          location.country,
        );
      })
      .expect(200);
  });

  it('delete location', async () => {
    const location = await createLocation(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
          mutation {
            deleteLocation (input: { location: { id: "${location.id}" } }){
              location {
              id
              }
            }
          }
          `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteLocation.location.id).toBe(location.id);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
