import { faker } from '@faker-js/faker';
import got from 'got';
import { MarkOptional } from 'ts-essentials';
import { ID } from '~/common';
import {
  CreateFileVersionInput,
  FileListInput,
  RequestUploadOutput,
} from '../../src/components/file/dto';
import { mimeTypes } from '../../src/components/file/mimeTypes';
import { TestApp } from './create-app';
import { RawFile, RawFileNode, RawFileNodeChildren } from './fragments';
import * as fragments from './fragments';
import { gql } from './gql-tag';

export const generateFakeFile = () => {
  const content = Buffer.from(
    faker.image.dataUri({ width: 200, height: 200 }).split(',')[1],
    'base64',
  );
  return {
    name: faker.system.fileName(),
    content: content,
    size: content.length,
    mimeType: faker.helpers.arrayElement(mimeTypes).name,
  };
};

export type FakeFile = ReturnType<typeof generateFakeFile>;

export async function requestFileUpload(
  app: TestApp,
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
  input: Partial<FakeFile> = {},
) => {
  const completeInput = {
    ...generateFakeFile(),
    ...input,
  };
  const { content, mimeType } = completeInput;

  await got.put(url, {
    headers: {
      'Content-Type': mimeType,
    },
    body: content,
    enableUnixSockets: true,
  });

  return completeInput;
};

export async function createFileVersion(
  app: TestApp,
  input: MarkOptional<CreateFileVersionInput, 'name'>,
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
    },
  );

  const actual: RawFile = result.createFileVersion;

  return actual;
}

export async function getFileNode(app: TestApp, id: ID) {
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
    },
  );

  const actual: RawFileNode = result.fileNode;

  return actual;
}

export async function getFileNodeChildren(
  app: TestApp,
  id: ID,
  input?: Partial<FileListInput>,
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
    },
  );

  const actual: RawFileNodeChildren = result.fileNode.children;

  return actual;
}
