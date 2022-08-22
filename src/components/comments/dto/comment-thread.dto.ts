import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps } from '../../../common';
import { Comment } from './comment.dto';

@ObjectType({
  implements: [Resource],
})
export class CommentThread extends Resource {
  static readonly Props = keysOf<CommentThread>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<CommentThread>>();
  static readonly Relations = {
    comments: [Comment],
  };
}
