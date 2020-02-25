import { Connection } from 'cypher-query-builder';
import * as request from 'supertest';
import { FileNodeType } from '../src/components/file/dto';
import { User } from '../src/components/user';
import {
  TestApp,
  createTestApp,
  createSession,
  fragments,
} from './utility';
import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';

describe('File e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('read file node by id', async () => {
    const token = await createSession(app);

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
    // since file is created, it can be read.
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          file (id:"${testFile?.file.properties.id}")
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

  afterAll(async () => {
    await app.close();
  });
});
