import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { ArrayNotEmpty } from 'class-validator';
import { type ID, IdField } from '~/common';
import { IsId } from '~/common/validators';
import { Post } from './post.dto';
import { PostShareability } from './shareability.dto';

@InputType()
export abstract class ModeratePost {
  @IdField()
  readonly id: ID<'Post'>;

  @Field(() => PostShareability, {
    description: `
      The reach to clear this post at.

      A moderator can clear what was requested or pick something narrower.
      Narrowing is the ordinary outcome, not a rejection — the post always
      stays, only its reach changes, which is why there is no reject mutation.

      Cannot exceed the requested reach: widening someone else's disclosure is a
      different decision from approving it, and not one to make by accident.
    `,
  })
  readonly shareability: PostShareability;
}

@InputType()
export abstract class ModeratePosts {
  @Field(() => [IDType], {
    description: `
      The posts to clear, all at the same reach.

      Bulk by default: at 1-2 prayer items per engagement per week, a reviewer
      holding a caseload cannot work one at a time, and a queue that only
      supports single approval is a queue that stops being read.
    `,
  })
  @ArrayNotEmpty()
  @IsId({ each: true })
  readonly ids: ReadonlyArray<ID<'Post'>>;

  @Field(() => PostShareability)
  readonly shareability: PostShareability;
}

@ObjectType()
export abstract class PostsModerated {
  @Field(() => [Post])
  readonly posts: readonly Post[];
}
