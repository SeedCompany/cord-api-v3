import { InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, IdField, SecuredProps } from '~/common';
import { CommentThread } from './comment-thread.dto';

@InterfaceType({
  description: stripIndent`
    An object that can be used to enable comment threads on a Node.
  `,
})
export abstract class Commentable {
  static readonly Props: string[] = keysOf<Commentable>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Commentable>>();
  static readonly Relations = {
    commentThreads: [CommentThread],
  };

  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;
}
