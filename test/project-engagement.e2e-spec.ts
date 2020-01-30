import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { generate, isValid } from 'shortid';
import { DateTime } from 'luxon';
import { createLanguage } from './language.e2e-spec';
import { createTestApp, TestApp } from './utility';

async function createProjectEngagement(
  app: INestApplication,
  projectEngagementName: string,
): Promise<string> {
  let projectEngagementId = '';
  await createLanguage(app, projectEngagementName);

  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createProjectEngagement (input: { projectEngagement: { languageName: "${projectEngagementName}" } }){
        projectEngagement {
        id,
        languageName
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      projectEngagementId =
        body.data.createProjectEngagement.projectEngagement.id;
    });
  return projectEngagementId;
}

describe('ProjectEngagement e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create projectEngagement', async () => {
    const languageName = 'projectEngagementName' + generate();
    await createLanguage(app, languageName);

    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createProjectEngagement (input: { projectEngagement: { languageName: "${languageName}" } }){
            projectEngagement {
            id
            languageName
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const projId = body.data.createProjectEngagement.projectEngagement.id;
        expect(isValid(projId)).toBe(true);
        expect(
          body.data.createProjectEngagement.projectEngagement.languageName,
        ).toBe(languageName);
      })
      .expect(200);
  });

  it('read one projectEngagement by id', async () => {
    const languageName = 'projectEngagementName' + Date.now();
    await createLanguage(app, languageName);

    // create projectEngagement first
    const projId = await createProjectEngagement(app, languageName);

    // test reading new org
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readProjectEngagement ( input: { projectEngagement: { id: "${projId}" } }){
            projectEngagement{
            id
            languageName
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readProjectEngagement.projectEngagement.id).toBe(
          projId,
        );
        expect(
          body.data.readProjectEngagement.projectEngagement.languageName,
        ).toBe(languageName);
      })
      .expect(200);
  });

  it('update projectEngagement', async () => {
    const languageName = 'projectEngagementName' + Date.now();
    await createLanguage(app, languageName);

    // create projectEngagement first
    const projId = await createProjectEngagement(app, languageName);
    const initialEndDate = DateTime.local().toString();
    const currentEndDate = DateTime.local().toString();

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateProjectEngagement (input: { projectEngagement: {
            id: "${projId}",
            initialEndDate: "${initialEndDate}",
            currentEndDate: "${currentEndDate}"
          } }){
            projectEngagement {
              id,
              initialEndDate,
              currentEndDate
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateProjectEngagement.projectEngagement.id).toBe(
          projId,
        );
        expect(
          body.data.updateProjectEngagement.projectEngagement.initialEndDate,
        ).toBe(initialEndDate);
        expect(
          body.data.updateProjectEngagement.projectEngagement.currentEndDate,
        ).toBe(currentEndDate);
      })
      .expect(200);
  });

  it('delete projectEngagement', async () => {
    const projectEngagementName = 'projectEngagementName' + Date.now();

    // create projectEngagement first
    const projId = await createProjectEngagement(app, projectEngagementName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteProjectEngagement (input: { projectEngagement: { id: "${projId}" } }){
            projectEngagement {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteProjectEngagement.projectEngagement.id).toBe(
          projId,
        );
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
