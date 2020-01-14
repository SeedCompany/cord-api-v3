import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { CreateProjectInput } from '../src/components/project/project.dto';

describe('Project e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create project', () => {
    const projectName = 'projectName' + Date.now();
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createProject (input: { project: { name: ${projectName} } }){
            project {
            id
            name
            deptId
            status
            possibleStatuses
            location
            publicLocation
            mouStart
            mouEnd
            languages
            partnerships
            sensitivity
            team
            budgets
            estimatedSubmission
            engagements
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

    // create org first
    let projId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createProject (input: { project: { name: "${projectName}" } }){
            project{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        projId = body.data.createProject.project.id;
      })
      .expect(200);

    // test reading new org
    return request(app.getHttpServer())
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

    // create org first
    let projId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
          mutation {
            createProject (input: { project: { name: "${projectName}" } }){
              project{
              id
              name
              }
            }
          }
          `,
      })
      .expect(({ body }) => {
        projId = body.data.createProject.project.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateProject (input: { project: {id: "${projId}", name: "${projectNameNew}" } }){
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

    // create org first
    let projId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
              mutation {
                createProject (input: { project: { name: "${projectName}" } }){
                  project{
                  id
                  name
                  }
                }
              }
              `,
      })
      .expect(({ body }) => {
        projId = body.data.createProject.project.id;
      })
      .expect(200);

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
