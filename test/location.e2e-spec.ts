import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { CreateLocationInput } from '../src/components/location/location.dto';
import { DatabaseUtility } from '../src/common/database-utility';

describe('Location e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // db = new DatabaseService();
    // orgService = new OrganizationService(db);
    // dbUtility = new DatabaseUtility(db, orgService);
    // await dbUtility.resetDatabaseForTesting();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    const db: DatabaseUtility = app.get(DatabaseUtility);
    await db.resetDatabaseForTesting();
  });

  it('create location', async () => {
    const locName = 'firstLocation';

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createLocation (input: { location: { name: "${locName}" } }){
            location{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        console.log(body.data);
        const locId = body.data.createLocation.location.id;
        expect(isValid(locId)).toBe(true);
        expect(body.data.createLocation.location.name).toBe(locName);
      })
      .expect(200);
  });

  it('read one location by id', async () => {
    const newLoc = new CreateLocationInput();
    newLoc.name = 'locNameLocTest1';

    // create loc first
    let locId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createLocation (input: { location: { name: "${newLoc.name}" } }){
            location{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        locId = body.data.createLocation.location.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readLocation ( input: { location: { id: "${locId}" } }){
            location{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readLocation.location.id).toBe(locId);
        expect(body.data.readLocation.location.name).toBe(newLoc.name);
      })
      .expect(200);
  });

  it('update location', async () => {
    const newLoc = new CreateLocationInput();
    newLoc.name = 'locNameForUpdateLocTest1';

    let locId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createLocation (input: { location: { name: "${newLoc.name}" } }){
            location{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        locId = body.data.createLocation.location.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateLocation (input: { location: {id: "${locId}", name: "${newLoc.name}" } }){
            location {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateLocation.location.id).toBe(locId);
        expect(body.data.updateLocation.location.name).toBe(newLoc.name);
      })
      .expect(200);
  });

  it('delete location', async () => {
    const newLoc = new CreateLocationInput();
    newLoc.name = 'locNameForDeleteLocTest1';

    let locId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createLocation (input: { location: { name: "${newLoc.name}" } }){
            location{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        locId = body.data.createLocation.location.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteLocation (input: { location: { id: "${locId}" } }){
            location {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteLocation.location.id).toBe(locId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
