import { EnumType, makeEnum } from '~/common';

export type PostType = EnumType<typeof PostType>;
export const PostType = makeEnum({
  name: 'PostType',
  values: ['Note', 'Story', 'Prayer'],
});
