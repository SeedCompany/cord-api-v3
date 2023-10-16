import { EnumType, makeEnum } from '~/common';

export type FileNodeType = EnumType<typeof FileNodeType>;
export const FileNodeType = makeEnum({
  name: 'FileNodeType',
  description:
    'The type of node in the file tree. A file, directory or file version.',
  values: ['Directory', 'File', 'FileVersion'],
});
