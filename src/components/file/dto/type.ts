import { registerEnumType } from '@nestjs/graphql';

export enum FileNodeType {
  Directory = 'dir',
  File = 'file',
}

registerEnumType(FileNodeType, {
  name: 'FileNodeType',
  description: 'The type of node in the file tree. A file or directory',
});
