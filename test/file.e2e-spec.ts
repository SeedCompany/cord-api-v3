import { generate } from 'shortid';
import * as request from 'supertest';
import { File } from '../src/components/file/dto';
import { createSession, createTestApp, createUser, TestApp } from './utility';

describe('File e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it.skip('Create FileNode', async () => {
    const id = generate();
    let testFile: File;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createFile( input: { uploadId:"${id}", parentId: "test-parent", name: "test-file"})
          {
            id
            type
          }
        }
        `,
      })
      .expect(({ body }) => {
        testFile = body.data.createFile;
      });

    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          file (id:"${id}")
          {
            id
            type
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.file.id).toBe(testFile.id);
        expect(body.data.file.type).toBe(testFile.type);
      })
      .expect(200);
  });
});
