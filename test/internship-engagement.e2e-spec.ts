import * as request from 'supertest';

import { Test, TestingModule } from '@nestjs/testing';
import { generate, isValid } from 'shortid';

import { AppModule } from '../src/app.module';
import { INestApplication } from '@nestjs/common';

async function createInternshipEngagement(
  app: INestApplication,
  possibleStatuses: string,
): Promise<string> {
  let internshipengagementId = '';
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createInternshipEngagement (input: { internshipengagement: { possibleStatuses: "${possibleStatuses}" } }){
        internshipengagement {
        id,
        possibleStatuses
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      internshipengagementId = body.data.createInternshipEngagement.internshipengagement.id;
    });
  return internshipengagementId;
}

describe('InternshipEngagement e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create internshipengagement', async () => {
    const internshipengagementName = 'internshipengagementName' + generate();
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createInternshipEngagement (input: { internshipengagement: { possibleStatuses: "${internshipengagementName}" } }){
            internshipengagement {
            id
            possibleStatuses
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const projId = body.data.createInternshipEngagement.internshipengagement.id;
        expect(isValid(projId)).toBe(true);
        expect(body.data.createInternshipEngagement.internshipengagement.possibleStatuses).toBe(internshipengagementName);
      })
      .expect(200);
  });

  it('read one internshipengagement by id', async () => {
    const internshipengagementName = 'internshipengagementName' + Date.now();

    // create internshipengagement first
    const projId = await createInternshipEngagement(app, internshipengagementName);

    // test reading new internship
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readInternshipEngagement ( input: { internshipengagement: { id: "${projId}" } }){
            internshipengagement{
            id
            possibleStatuses
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readInternshipEngagement.internshipengagement.id).toBe(projId);
        expect(body.data.readInternshipEngagement.internshipengagement.possibleStatuses).toBe(internshipengagementName);
      })
      .expect(200);
  });

  it('update internshipengagement', async () => {
    const internshipengagementName = 'internshipengagementOld' + Date.now();
    const internshipengagementNameNew = 'internshipengagementNew' + Date.now();

    // create internshipengagement first
    const projId = await createInternshipEngagement(app, internshipengagementName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateInternshipEngagement (input: { internshipengagement: {
            id: "${projId}",
            possibleStatuses: "${internshipengagementNameNew}",
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
            internshipengagement {
            id
            possibleStatuses
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateInternshipEngagement.internshipengagement.id).toBe(projId);
        expect(body.data.updateInternshipEngagement.internshipengagement.possibleStatuses).toBe(internshipengagementNameNew);
      })
      .expect(200);
  });

  it('delete internshipengagement', async () => {
    const internshipengagementName = 'internshipengagementName' + Date.now();

    // create internshipengagement first
    const projId = await createInternshipEngagement(app, internshipengagementName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteInternshipEngagement (input: { internshipengagement: { id: "${projId}" } }){
            internshipengagement {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteInternshipEngagement.internshipengagement.id).toBe(projId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
