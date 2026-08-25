import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { type ID, IdField } from '~/common';
import { PostType } from './post-type.enum';
import { Post } from './post.dto';
import { PostShareability } from './shareability.dto';

@InputType()
export class CreatePost {
  @IdField()
  readonly parent: ID;

  @Field(() => PostType)
  readonly type: PostType;

  @Field(() => PostShareability)
  readonly shareability: PostShareability;

  @Field({
    description: 'The post body',
  })
  @IsNotEmpty()
  readonly body: string;

  @IdField({
    nullable: true,
    description: `
      Submit this post as part of a quarterly report.

      Optional: a post created straight on an engagement between reports leaves
      this unset, and can be attached to a report later.
    `,
  })
  readonly report?: ID<'PeriodicReport'> | null;

  @IdField({
    nullable: true,
    description:
      'An earlier post that this one updates, e.g. an answered prayer.',
  })
  readonly respondsTo?: ID<'Post'> | null;
}

@ObjectType()
export abstract class PostCreated {
  @Field()
  readonly post: Post;
}
