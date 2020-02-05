import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import * as request from 'supertest';
import { createTestApp, createUser, TestApp } from './utility';

async function createInternshipEngagement(
  app: TestApp,
): Promise<string> {
  let internshipEngagementId = '';
  // create a test user to link
  const user = await createUser(app);

  // create an internshipEngagement to that user
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createInternshipEngagement (input:
        { internshipEngagement:
          {  internId: "${user.id}"}
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
    `,
    })
    .then(({ body }) => {
      internshipEngagementId =
        body.data.createInternshipEngagement.internshipEngagement.id;
    });
  return internshipEngagementId;
}

describe.skip('InternshipEngagement e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create internshipEngagement', async () => {
    // create a test user to link
    const user = await createUser(app);

    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createInternshipEngagement (input:
            { internshipEngagement:
              {  internId : "${user.id}"}
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
        `,
      })
      .expect(({ body }) => {
        const internshipEngagementId =
          body.data.createInternshipEngagement.internshipEngagement.id;
        expect(isValid(internshipEngagementId)).toBe(true);
      })
      .expect(200);
  });

  it('read one internshipEngagement by id', async () => {
    // create user first
    const internshipEngagementId = await createInternshipEngagement(
      app,
    );

    // test reading new internship
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readInternshipEngagement ( input: { internshipEngagement: { id: "${internshipEngagementId}" } }){
            internshipEngagement{
              id
            }
            intern {
              id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readInternshipEngagement.internshipEngagement.id).toBe(
          internshipEngagementId,
        );
      })
      .expect(200);
  });

  it('update internshipEngagement', async () => {

    // create internshipEngagement first
    const internshipEngagementId = await createInternshipEngagement(
      app,
    );
    const initialEndDate = DateTime.local().toString();
    const currentEndDate = DateTime.local().toString();

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateInternshipEngagement (input: { internshipEngagement: {
            id: "${internshipEngagementId}"
            currentEndDate: "${currentEndDate}"
            initialEndDate: "${initialEndDate}"
          } }){
            internshipEngagement {
              id
              currentEndDate
              initialEndDate
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(
          body.data.updateInternshipEngagement.internshipEngagement.id,
        ).toBe(internshipEngagementId);
        expect(
          body.data.updateInternshipEngagement.internshipEngagement.currentEndDate,
        ).toBe(currentEndDate);
        expect(
          body.data.updateInternshipEngagement.internshipEngagement.initialEndDate,
        ).toBe(initialEndDate);
      })
      .expect(200);
  });

  it('delete internshipEngagement', async () => {

    // create internshipEngagement first
    const internshipEngagementId = await createInternshipEngagement(
      app,
    );

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteInternshipEngagement (input: { internshipEngagement: { id: "${internshipEngagementId}" } }){
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
        ).toBe(internshipEngagementId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
