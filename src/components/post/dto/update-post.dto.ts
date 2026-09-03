import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { type ID, IdField } from '~/common';
import { PostType } from './post-type.enum';
import { Post } from './post.dto';
import { PostShareability } from './shareability.dto';

@InputType()
export abstract class UpdatePost {
  @IdField()
  readonly id: ID;

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
      Attach to, or (with an explicit null) detach from, a quarterly report.

      Detaching leaves the post on its engagement rather than deleting it — that
      is the difference between "not in this report" and "gone".
    `,
  })
  readonly report?: ID<'PeriodicReport'> | null;

  @Field(() => String, {
    nullable: true,
    description: `
      Set (or with an explicit null, clear) the finalized wording — a
      translation, a moderator's touch-up, or both. Leave unset to change
      other fields without touching this one; see \`Post.finalBody\`.
    `,
  })
  readonly finalBody?: string | null;
}

@ObjectType()
export abstract class PostUpdated {
  @Field()
  readonly post: Post;
}
