import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { isValid, generate } from 'shortid';
import { createTestApp, TestApp } from './utility';

async function createProject(
  app: INestApplication,
  projectName: string,
): Promise<string> {
  let projectId = '';
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createProject (input: { project: { name: "${projectName}" } }){
        project {
        id,
        name
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      projectId = body.data.createProject.project.id;
    });
  return projectId;
}

describe('Project e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create project', async () => {
    const projectName = 'projectName' + generate();
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createProject (input: { project: { name: "${projectName}" } }){
            project {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const projId = body.data.createProject.project.id;
        expect(isValid(projId)).toBe(true);
        expect(body.data.createProject.project.name).toBe(projectName);
      })
      .expect(200);
  });

  it('read one project by id', async () => {
    const projectName = 'projectName' + Date.now();

    // create project first
    const projId = await createProject(app, projectName);

    // test reading new org
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readProject ( input: { project: { id: "${projId}" } }){
            project{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readProject.project.id).toBe(projId);
        expect(body.data.readProject.project.name).toBe(projectName);
      })
      .expect(200);
  });

  it('update project', async () => {
    const projectName = 'projectOld' + Date.now();
    const projectNameNew = 'projectNew' + Date.now();

    // create project first
    const projId = await createProject(app, projectName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateProject (input: { project: {
            id: "${projId}",
            name: "${projectNameNew}",
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
            project {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateProject.project.id).toBe(projId);
        expect(body.data.updateProject.project.name).toBe(projectNameNew);
      })
      .expect(200);
  });

  it('delete project', async () => {
    const projectName = 'projectName' + Date.now();

    // create project first
    const projId = await createProject(app, projectName);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteProject (input: { project: { id: "${projId}" } }){
            project {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteProject.project.id).toBe(projId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
