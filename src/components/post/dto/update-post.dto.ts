import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
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
}

@InputType()
export abstract class UpdatePostInput {
  @Field()
  @Type(() => UpdatePost)
  @ValidateNested()
  readonly post: UpdatePost;
}

@ObjectType()
export abstract class UpdatePostOutput {
  @Field()
  readonly post: Post;
}
