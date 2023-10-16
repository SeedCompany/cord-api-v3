import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { BaseNode } from '~/core/database/results';
import { RegisterResource } from '~/core/resources';
import {
  DateTimeField,
  ID,
  Resource,
  Secured,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { PostType } from './post-type.enum';
import { PostShareability } from './shareability.dto';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class Post extends Resource {
  static readonly Props = keysOf<Post>();
  static readonly SecuredProps = keysOf<SecuredProps<Post>>();
  static readonly Parent = 'dynamic';

  readonly parent: BaseNode;

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

declare module '~/core/resources/map' {
  interface ResourceMap {
    Post: typeof Post;
  }
}
