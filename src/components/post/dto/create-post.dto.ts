import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { Post } from './post.dto';
import { PostShareability } from './shareability.dto';
import { PostType } from './type.enum';

@InputType()
export class CreatePost {
  @IdField({ nullable: true })
  readonly parentId?: string;

  @Field(() => PostType)
  readonly type: PostType;

  @Field(() => PostShareability)
  readonly shareability: PostShareability;

  @Field({
    description: 'the post body',
  })
  readonly body: string;
}

@InputType()
export abstract class CreatePostInput {
  @Field()
  @Type(() => CreatePost)
  @ValidateNested()
  readonly post: CreatePost;
}

@ObjectType()
export abstract class CreatePostOutput {
  @Field()
  readonly post: Post;
}
