import * as request from 'supertest';

import { File, FileNodeType } from '../src/components/file/dto';
import {
  TestApp,
  createSession,
  createTestApp,
  createUser,
} from './utility';
import { generate } from 'shortid';
import { User } from '../src/components/user';

describe('File e2e', () => {
  let app: TestApp;
  let session: string;
  let user: User;

  beforeAll(async () => {
    app = await createTestApp();
    session = await createSession(app);
    user = await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Create FileNode', async () => {
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
        console.log('body is---->', body);
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
