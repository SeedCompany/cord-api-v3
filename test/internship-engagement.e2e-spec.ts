import * as request from 'supertest';

import { Test, TestingModule } from '@nestjs/testing';
import { generate, isValid } from 'shortid';

import { AppModule } from '../src/app.module';
import { INestApplication } from '@nestjs/common';
import { createUser } from './test-utility';

async function createInternshipEngagement(
  app: INestApplication,
  internName: string = 'George',
): Promise<string> {
  let internshipEngagementId = '';
  // create a test user to link
  const userId = await createUser(app);

  // create an internshipEngagement to that user
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createInternshipEngagement (input:
        { internshipEngagement:
          {  internId = "$internId"}
        }){
          internshipEngagement {
            id
            initialEndDate
            currentEndDate
          }
          intern {
            id
            email
            displayFirstName
            displayLastName
            realFirstName
            realLastName
          }
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      internshipEngagementId =
        body.data.createInternshipEngagement.internshipEngagement.id;
    });
  return internshipEngagementId;
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

  it('create internshipEngagement', async () => {
    const internshipEngagementName = 'internshipEngagementName' + generate();
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createInternshipEngagement (input: { internshipEngagement: { } }){
            internshipEngagement {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const projId =
          body.data.createInternshipEngagement.internshipEngagement.id;
        expect(isValid(projId)).toBe(true);
        expect(
          body.data.createInternshipEngagement.internshipEngagement
            .possibleStatuses,
        ).toBe(internshipEngagementName);
      })
      .expect(200);
  });

  it('read one internshipEngagement by id', async () => {
    const internshipEngagementName = 'internshipEngagementName' + Date.now();

    // create internshipEngagement first
    const projId = await createInternshipEngagement(
      app,
      internshipEngagementName,
    );

    // test reading new internship
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readInternshipEngagement ( input: { internshipEngagement: { id: "${projId}" } }){
            internshipEngagement{
            id
            possibleStatuses
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readInternshipEngagement.internshipEngagement.id).toBe(
          projId,
        );
      })
      .expect(200);
  });

  it('update internshipEngagement', async () => {
    const internshipEngagementName = 'internshipEngagementOld' + Date.now();
    const internshipEngagementNameNew = 'internshipEngagementNew' + Date.now();

    // create internshipEngagement first
    const projId = await createInternshipEngagement(
      app,
      internshipEngagementName,
    );

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateInternshipEngagement (input: { internshipEngagement: {
            id: "${projId}",
            possibleStatuses: "${internshipEngagementNameNew}",
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
            internshipEngagement {
            id
            possibleStatuses
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(
          body.data.updateInternshipEngagement.internshipEngagement.id,
        ).toBe(projId);
      })
      .expect(200);
  });

  it('delete internshipEngagement', async () => {
    const internshipEngagementName = 'internshipEngagementName' + Date.now();

    // create internshipengagement first
    const projId = await createInternshipEngagement(
      app,
      internshipEngagementName,
    );

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteInternshipEngagement (input: { internshipEngagement: { id: "${projId}" } }){
            internshipEngagement {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(
          body.data.deleteInternshipEngagement.internshipEngagement.id,
        ).toBe(projId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
