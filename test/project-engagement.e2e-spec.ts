import * as request from 'supertest';

import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generate, isValid } from 'shortid';

import { AppModule } from '../src/app.module';
import { createLanguage } from './language.e2e-spec';

async function createProjectEngagement(
  app: INestApplication,
  projectEngagementName: string,
): Promise<string> {
  let projectEngagementId = '';
  const languageId = await createLanguage(app, projectEngagementName);

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

describe.only('ProjectEngagement e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    Logger.overrideLogger(['error']);
  });

  it.only('create projectEngagement', async () => {
    const languageName = 'projectEngagementName' + generate();
    await createLanguage(app, languageName)

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
        console.log(JSON.stringify(body));
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
    const languageId = await createLanguage(app, languageName);

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
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readProjectEngagement.projectEngagement.id).toBe(
          projId,
        );
        expect(body.data.readProjectEngagement.projectEngagement.languageName).toBe(
          languageName,
        );
      })
      .expect(200);
  });

  it('update projectEngagement', async () => {
    const projectEngagementName = 'projectEngagementOld' + Date.now();
    const projectEngagementNameNew = 'projectEngagementNew' + Date.now();

    // create projectEngagement first
    const projId = await createProjectEngagement(app, projectEngagementName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateProjectEngagement (input: { projectEngagement: {
            id: "${projId}",
            name: "${projectEngagementNameNew}",
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
            projectengagement {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateProjectEngagement.projectEngagement.id).toBe(
          projId,
        );
        expect(body.data.updateProjectEngagement.projectEngagement.name).toBe(
          projectEngagementNameNew,
        );
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
