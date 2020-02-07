import * as request from 'supertest';
import { CreateRegionInput } from '../src/components/region/region.dto';
import { isValid } from 'shortid';
import { createTestApp, TestApp } from './utility';

describe('Region e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create Region', async () => {
    const regionName = 'firstRegion' + Date.now();

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createRegion (input: { region: { name: "${regionName}" } }){
            region{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const regionId = body.data.createRegion.region.id;
        expect(isValid(regionId)).toBe(true);
        expect(body.data.createRegion.region.name).toBe(regionName);
      })
      .expect(200);
  });

  it('read one Region by id', async () => {
    const newRegion = new CreateRegionInput();
    newRegion.name = 'Region1' + Date.now();

    // create loc first
    let regionId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createRegion (input: { region: { name: "${newRegion.name}" } }){
            region{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        regionId = body.data.createRegion.region.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readRegion ( input: { region: { id: "${regionId}" } }){
            region{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readRegion.region.id).toBe(regionId);
        expect(body.data.readRegion.region.name).toBe(newRegion.name);
      })
      .expect(200);
  });

  it('update Region', async () => {

    const oldRegion = 'RegionName' + Date.now();
    const newRegion = 'RegionNameForUpdate' + Date.now();

    let regionId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createRegion (input: { region: { name: "${oldRegion}" } }){
            region{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        regionId = body.data.createRegion.region.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateRegion (input: { region: {id: "${regionId}", name: "${newRegion}" } }){
            region {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateRegion.region.id).toBe(regionId);
        expect(body.data.updateRegion.region.name).toBe(newRegion);
      })
      .expect(200);
  });

  it('delete Region', async () => {
    const regionName = 'RegionName' + Date.now();

    let regionId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createRegion (input: { region: { name: "${regionName}" } }){
            region{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        regionId = body.data.createRegion.region.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteRegion (input: { region: { id: "${regionId}" } }){
            region {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteRegion.region.id).toBe(regionId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
