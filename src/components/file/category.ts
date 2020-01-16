import { registerEnumType } from 'type-graphql';

export enum FileNodeCategory {
  Audio = 'audio',
  Directory = 'directory',
  Document = 'doc',
  Image = 'image',
  Other = 'other',
  Spreadsheet = 'spreadsheet',
  Video = 'video',
}

registerEnumType(FileNodeCategory, { name: 'FileNodeCategory' });
