import * as request from 'supertest';

import { File, FileNodeType } from '../src/components/file/dto';
import {
  TestApp,
  createSession,
  createTestApp,
  createUser,
  fragments,
} from './utility';
import { generate, isValid } from 'shortid';

import { Connection } from 'cypher-query-builder';
import { User } from '../src/components/user';
import { createFile } from './utility/create-file';
import { gql } from 'apollo-server-core';

describe('File e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Create FileNode', async () => {
    const token = await createSession(app);
    const testUser = await createUser(app);
    const dbService = await app.get(Connection);
    const id = generate();
    let testFile: File;
    await request(app.getHttpServer())
      .post('/graphql')
      .set('authorization', `Bearer ${token}`)
      .send({
        operationName: null,
        query: `
        mutation {
          createFile( input: { uploadId:"${id}", parentId: "test-parent", name: "test-file"})
          {
            id
          }
        }
        `,
      })
      .expect(({ body }) => {
        testFile = body.data.file;
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
        expect(body.data.file.id).toBe(id);
      })
      .expect(200);
  });

  it('read FileNode by id', async () => {

    const dbService = await app.get(Connection);
    const testFile = await dbService
      .query()
      .raw(`
        CREATE (file:FileNode { id: $id, type: $type, name: $name})
        RETURN file
        `,
        {
          id: generate(),
          type: FileNodeType.File,
          name: 'test-file',
        })
      .first();
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          file (id:"${testFile!.file.properties.id}")
          {
            type
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.file.type).toBe('File');
      })
      .expect(200);
  });
});
