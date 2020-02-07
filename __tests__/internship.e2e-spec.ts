import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { isValid, generate } from 'shortid';
import { createTestApp, TestApp } from './utility';

async function createInternship(
  app: INestApplication,
  internshipName: string,
): Promise<string> {
  let internshipId = '';
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createInternship (input: { internship: { name: "${internshipName}" } }){
        internship {
        id,
        name
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      internshipId = body.data.createInternship.internship.id;
    });
  return internshipId;
}

describe('Internship e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create internship', async () => {
    const internshipName = 'internshipName' + generate();
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createInternship (input: { internship: { name: "${internshipName}" } }){
            internship {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const internId = body.data.createInternship.internship.id;
        expect(isValid(internId)).toBe(true);
        expect(body.data.createInternship.internship.name).toBe(internshipName);
      })
      .expect(200);
  });

  it('read one internship by id', async () => {
    const internshipName = 'internshipName' + Date.now();

    // create internship first
    const internId = await createInternship(app, internshipName);

    // test reading new org
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readInternship ( input: { internship: { id: "${internId}" } }){
            internship{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readInternship.internship.id).toBe(internId);
        expect(body.data.readInternship.internship.name).toBe(internshipName);
      })
      .expect(200);
  });

  it('update internship', async () => {
    const internshipName = 'internshipOld' + Date.now();
    const internshipNameNew = 'internshipNew' + Date.now();

    // create internship first
    const internId = await createInternship(app, internshipName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateInternship (input: { internship: {
            id: "${internId}",
            name: "${internshipNameNew}",
            deptId: null,
            status: null,
            location: null,
            publicLocation: null,
            mouStart: null,
            mouEnd: null,
            partnerships: null,
            sensitivity: null,
            team: null,
            budgets: null,
            estimatedSubmission: null,
            engagements: null,
          } }){
            internship {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateInternship.internship.id).toBe(internId);
        expect(body.data.updateInternship.internship.name).toBe(internshipNameNew);
      })
      .expect(200);
  });

  it('delete internship', async () => {
    const internshipName = 'internshipName' + Date.now();

    // create internship first
    const internId = await createInternship(app, internshipName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteInternship (input: { internship: { id: "${internId}" } }){
            internship {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteInternship.internship.id).toBe(internId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
