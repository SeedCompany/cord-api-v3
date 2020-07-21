import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { assert, MarkOptional } from 'ts-essentials';
import {
  CreateFileVersionInput,
  FileListInput,
  RequestUploadOutput,
} from '../../src/components/file';
import { LocalBucket } from '../../src/components/file/bucket';
import { FilesBucketToken } from '../../src/components/file/files-bucket.factory';
import { mimeTypes } from '../../src/components/file/mimeTypes';
import { TestApp } from './create-app';
import { RawFile, RawFileNode, RawFileNodeChildren } from './fragments';
import * as fragments from './fragments';

export const generateFakeFile = () => ({
  name: faker.system.fileName(),
  content: Buffer.from(faker.image.dataUri(200, 200).split(',')[1], 'base64'),
  size: faker.random.number(1_000_000),
  mimeType: faker.random.arrayElement(mimeTypes).name,
});

export type FakeFile = ReturnType<typeof generateFakeFile>;

export async function requestFileUpload(
  app: TestApp
): Promise<RequestUploadOutput> {
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

// fake file upload, this would normally be a direct POST to S3 from the client
export const uploadFileContents = async (
  app: TestApp,
  url: string,
  input: Partial<FakeFile> = {}
) => {
  const completeInput = {
    ...generateFakeFile(),
    ...input,
  };
  const {
    content: Body,
    mimeType: ContentType,
    size: ContentLength,
  } = completeInput;

  const bucket = app.get(FilesBucketToken);
  assert(bucket instanceof LocalBucket);
  await bucket.upload(url, {
    Body,
    ContentType,
    ContentLength,
  });

  return completeInput;
};

export async function createFileVersion(
  app: TestApp,
  input: MarkOptional<CreateFileVersionInput, 'name'>
) {
  const file: CreateFileVersionInput = {
    ...input,
    uploadId: input.uploadId,
    parentId: input.parentId,
    name: input.name ?? faker.system.fileName(),
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createFileVersion($input: CreateFileVersionInput!) {
        createFileVersion(input: $input) {
          ...fileNode
        }
      }
      ${fragments.fileNode}
    `,
    {
      input: file,
    }
  );

  const actual: RawFile = result.createFileVersion;

  return actual;
}

export async function getFileNode(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query getFileNode($id: ID!) {
        fileNode(id: $id) {
          ...fileNode
        }
      }
      ${fragments.fileNode}
    `,
    {
      id,
    }
  );

  const actual: RawFileNode = result.fileNode;

  return actual;
}

export async function getFileNodeChildren(
  app: TestApp,
  id: string,
  input?: Partial<FileListInput>
) {
  const result = await app.graphql.query(
    gql`
      query getFileNode($id: ID!, $input: FileListInput) {
        fileNode(id: $id) {
          ... on File {
            children(input: $input) {
              ...children
            }
          }
          ... on Directory {
            children(input: $input) {
              ...children
            }
          }
        }
      }
      ${fragments.fileNodeChildren}
    `,
    {
      id,
      input,
    }
  );

  const actual: RawFileNodeChildren = result.fileNode.children;

  return actual;
}
