import * as request from 'supertest';
import { generate } from 'shortid';
import { isValid } from 'shortid';
import { CreateAreaInput } from '../src/components/area/area.dto';
import { createTestApp, TestApp } from './utility';

describe('Area e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create Area', async () => {
    const areaName = 'firstArea' + generate();

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createArea (input: { area: { name: "${areaName}" } }){
            area{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const areaId = body.data.createArea.area.id;
        expect(isValid(areaId)).toBe(true);
        expect(body.data.createArea.area.name).toBe(areaName);
      })
      .expect(200);
  });

  it('read one area by id', async () => {
    const newArea = new CreateAreaInput();
    newArea.name = 'area1' + generate();

    // create loc first
    let areaId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createArea (input: { area: { name: "${newArea.name}" } }){
            area{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        areaId = body.data.createArea.area.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readArea ( input: { area: { id: "${areaId}" } }){
            area{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readArea.area.id).toBe(areaId);
        expect(body.data.readArea.area.name).toBe(newArea.name);
      })
      .expect(200);
  });

  it('update Area', async () => {
    const newArea = new CreateAreaInput();
    newArea.name = 'areaNameForUpdate' + generate();

    let areaId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createArea (input: { area: { name: "${newArea.name}" } }){
            area{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        areaId = body.data.createArea.area.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateArea (input: { area: {id: "${areaId}", name: "${newArea.name}" } }){
            area {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateArea.area.id).toBe(areaId);
        expect(body.data.updateArea.area.name).toBe(newArea.name);
      })
      .expect(200);
  });

  it('delete Area', async () => {
    const newArea = new CreateAreaInput();
    newArea.name = 'areaForDelete' + generate();

    let areaId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createArea (input: { area: { name: "${newArea.name}" } }){
            area{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        areaId = body.data.createArea.area.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteArea (input: { area: { id: "${areaId}" } }){
            area {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteArea.area.id).toBe(areaId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
