import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { MarkOptional } from 'ts-essentials';
import { CreateFileVersionInput } from '../../src/components/file';
import { MemoryBucket } from '../../src/components/file/memory-bucket';
import { mimeTypes } from '../../src/components/file/mimeTypes';
import { TestApp } from './create-app';
import { RawFile } from './fragments';
import * as fragments from './fragments';

export const generateFakeFile = () => ({
  name: faker.system.fileName(),
  content: faker.lorem.paragraph(),
  size: faker.random.number(1_000_000),
  mimeType: faker.random.arrayElement(mimeTypes).name,
});

export type FakeFile = ReturnType<typeof generateFakeFile>;

export async function uploadFile(
  app: TestApp,
  parentId: string,
  input: Partial<FakeFile> = {}
) {
  const { id, url } = await requestFileUpload(app);

  // fake file upload, this would normally be a direct POST to S3 from the client
  const { name, content: Body, mimeType: ContentType, size: ContentLength } = {
    ...generateFakeFile(),
    ...input,
  };
  app.get(MemoryBucket).save(url, {
    Body,
    ContentType,
    ContentLength,
  });

  const file = await createFileVersion(app, {
    uploadId: id,
    parentId,
    name: input.name ?? name,
  });

  return file;
}

export async function requestFileUpload(app: TestApp) {
  const res = await app.graphql.mutate(gql`
    mutation {
      requestFileUpload {
        id
        url
      }
    }
  `);
  return res.requestFileUpload;
}

export async function createFileVersion(
  app: TestApp,
  input: MarkOptional<CreateFileVersionInput, 'name'>
) {
  const file: CreateFileVersionInput = {
    uploadId: input.uploadId,
    parentId: input.parentId,
    ...input,
    name: input.name ?? faker.system.fileName(),
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createFileVersion($input: CreateFileVersionInput!) {
        createFileVersion(input: $input) {
          ...file
        }
      }
      ${fragments.file}
    `,
    {
      input: file,
    }
  );

  const actual: RawFile = result.createFileVersion;

  return actual;
}
