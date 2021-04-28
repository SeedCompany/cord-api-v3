import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  Resource,
  Secured,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { PostType } from './type.enum';

@ObjectType({
  implements: [Resource],
})
export class Post extends Resource {
  static readonly Props = keysOf<Post>();
  static readonly SecuredProps = keysOf<SecuredProps<Post>>();

  readonly creator: Secured<string>;

  @Field(() => PostType)
  readonly type: PostType;

  @Field(() => Boolean)
  readonly shareable: boolean;

  @Field()
  readonly body: SecuredString;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
