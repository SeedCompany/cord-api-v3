import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  Resource,
  Secured,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { PostShareability } from './shareability.dto';
import { PostType } from './type.enum';

@ObjectType({
  implements: [Resource],
})
export class Post extends Resource {
  static readonly Props = keysOf<Post>();
  static readonly SecuredProps = keysOf<SecuredProps<Post>>();
  static readonly Parent = 'dynamic';

  readonly creator: Secured<ID>;

  @Field(() => PostType)
  readonly type: PostType;

  @Field(() => PostShareability)
  readonly shareability: PostShareability;

  @Field()
  readonly body: SecuredString;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
