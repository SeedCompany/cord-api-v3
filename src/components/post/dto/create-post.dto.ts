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
}

@ObjectType()
export abstract class PostCreated {
  @Field()
  readonly post: Post;
}
