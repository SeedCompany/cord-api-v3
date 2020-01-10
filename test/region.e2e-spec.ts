import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { CreateRegionInput } from '../src/components/region/region.dto';
import { DatabaseUtility } from '../src/common/database-utility';

describe('Region e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    const db: DatabaseUtility = app.get(DatabaseUtility);
    // await db.resetDatabaseForTesting();
  });

  it('create Region', async () => {
    const regionName = 'firstRegion';

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
    newRegion.name = 'Region1';

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
    const newRegion = new CreateRegionInput();
    newRegion.name = 'RegionNameForUpdate';

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
        mutation {
          updateRegion (input: { region: {id: "${regionId}", name: "${newRegion.name}" } }){
            Region {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateRegion.region.id).toBe(regionId);
        expect(body.data.updateRegion.region.name).toBe(newRegion.name);
      })
      .expect(200);
  });

  it('delete Region', async () => {
    const newRegion = new CreateRegionInput();
    newRegion.name = 'RegionForDelete';

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
        mutation {
          deleteRegion (input: { Region: { id: "${regionId}" } }){
            Region {
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
