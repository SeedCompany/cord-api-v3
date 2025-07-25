import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, Resource, type Secured, SecuredString } from '~/common';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { PostType } from './post-type.enum';
import { PostShareability } from './shareability.dto';

@RegisterResource({ db: e.Post })
@ObjectType({
  implements: [Resource],
})
export class Post extends Resource {
  static readonly Parent = 'dynamic';

  readonly parent: BaseNode;

  readonly creator: Secured<LinkTo<'User'>>;

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
  interface ResourceDBMap {
    Post: typeof e.default.Post;
  }
}
