import { stripIndent } from 'common-tags';
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

registerEnumType(FileNodeCategory, {
  name: 'FileNodeCategory',
  description: stripIndent`
    The category of the node.
    This is intended to be a simplified version of the MIME type.
    For example, it can be used to show different icons in a list view.
  `,
});
