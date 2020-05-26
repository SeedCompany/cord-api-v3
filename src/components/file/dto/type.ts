import { registerEnumType } from '@nestjs/graphql';

export enum FileNodeType {
  Directory = 'dir',
  File = 'file',
  FileVersion = 'fileVersion',
}

registerEnumType(FileNodeType, {
  name: 'FileNodeType',
  description:
    'The type of node in the file tree. A file, directory or file version.',
});
