import { faker } from '@faker-js/faker';
import { type SetOptional } from 'type-fest';
import { type ID } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { mimeTypes } from '../../src/components/file/mimeTypes';
import type { Tester } from '../setup';
import { fragments } from '../utility';

export const generateFakeFile = () => {
  const content = Buffer.from(
    faker.image.dataUri({ width: 200, height: 200 }).split(',')[1]!,
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

export const requestFileUpload = () => async (tester: Tester) => {
  const res = await tester.run(RequestFileUploadDoc);
  return res.requestFileUpload;
};
const RequestFileUploadDoc = graphql(`
  mutation RequestFileUpload {
    requestFileUpload {
      id
      url
    }
  }
`);

export const uploadFileContents =
  (url: string, input: Partial<FakeFile> = {}) =>
  async (tester: Tester) => {
    const completeInput = {
      ...generateFakeFile(),
      ...input,
    };
    const { content, mimeType } = completeInput;

    await tester.http.put(url, {
      headers: {
        'Content-Type': mimeType,
      },
      body: content,
    });

    return completeInput;
  };

export const createFileVersion =
  (input: SetOptional<InputOf<typeof CreateFileVersionDoc>, 'name'>) =>
  async (tester: Tester) => {
    const result = await tester.run(CreateFileVersionDoc, {
      input: {
        ...input,
        upload: input.upload,
        parent: input.parent,
        name: input.name ?? faker.system.fileName(),
      },
    });

    const actual = result.createFileVersion;

    return actual;
  };

const CreateFileVersionDoc = graphql(
  `
    mutation createFileVersion($input: CreateFileVersion!) {
      createFileVersion(input: $input) {
        ...fileNode
      }
    }
  `,
  [fragments.fileNode],
);

export const getFileNode = (id: ID) => async (tester: Tester) => {
  const { fileNode } = await tester.run(GetFileNodeDoc, { id });
  return fileNode;
};

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

export const getFileNodeChildren =
  (id: ID, input?: InputOf<typeof GetFileNodeChildrenDoc>) =>
  async (tester: Tester) => {
    const result = await tester.run(GetFileNodeChildrenDoc, {
      id,
      input,
    });
    if (result.fileNode.__typename === 'FileVersion') throw new Error();

    const actual = result.fileNode.children;

    return actual;
  };

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
