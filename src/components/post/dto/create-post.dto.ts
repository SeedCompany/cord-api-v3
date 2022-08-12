import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { Post } from './post.dto';
import { PostShareability } from './shareability.dto';
import { PostType } from './type.enum';

@InputType()
export class CreatePost {
  @IdField()
  readonly parentId: ID;

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
