import { faker } from '@faker-js/faker';
import got from 'got';
import { type SetOptional } from 'type-fest';
import { type ID } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { mimeTypes } from '../../src/components/file/mimeTypes';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

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

export async function requestFileUpload(app: TestApp) {
  const res = await app.graphql.mutate(RequestFileUploadDoc);
  return res.requestFileUpload;
}
const RequestFileUploadDoc = graphql(`
  mutation RequestFileUpload {
    requestFileUpload {
      id
      url
    }
  }
`);

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
  input: SetOptional<InputOf<typeof CreateFileVersionDoc>, 'name'>,
) {
  const result = await app.graphql.mutate(CreateFileVersionDoc, {
    input: {
      ...input,
      uploadId: input.uploadId,
      parentId: input.parentId,
      name: input.name ?? faker.system.fileName(),
    },
  });

  const actual = result.createFileVersion;

  return actual;
}
const CreateFileVersionDoc = graphql(
  `
    mutation createFileVersion($input: CreateFileVersionInput!) {
      createFileVersion(input: $input) {
        ...fileNode
      }
    }
  `,
  [fragments.fileNode],
);

export async function getFileNode(app: TestApp, id: ID) {
  const { fileNode } = await app.graphql.query(GetFileNodeDoc, { id });
  return fileNode;
}
const GetFileNodeDoc = graphql(
  `
    query getFileNode($id: ID!) {
      fileNode(id: $id) {
        ...fileNode
      }
    }
  `,
  [fragments.fileNode],
);

export async function getFileNodeChildren(
  app: TestApp,
  id: ID,
  input?: InputOf<typeof GetFileNodeChildrenDoc>,
) {
  const result = await app.graphql.query(GetFileNodeChildrenDoc, {
    id,
    input,
  });
  if (result.fileNode.__typename === 'FileVersion') throw new Error();

  const actual = result.fileNode.children;

  return actual;
}
const GetFileNodeChildrenDoc = graphql(
  `
    query getFileNodeChildren($id: ID!, $input: FileListInput) {
      fileNode(id: $id) {
        __typename
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
  `,
  [fragments.fileNodeChildren],
);
