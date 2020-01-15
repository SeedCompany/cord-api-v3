import { registerEnumType } from 'type-graphql';

export enum FileNodeType {
  Directory = 'dir',
  File = 'file',
}

registerEnumType(FileNodeType, { name: 'FileNodeType' });
