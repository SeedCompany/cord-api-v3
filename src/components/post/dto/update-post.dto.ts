import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { Post } from './post.dto';
import { PostType } from './type.enum';

@InputType()
export abstract class UpdatePost {
  @IdField()
  readonly id: ID;

  @Field(() => PostType)
  readonly type: PostType;

  @Field(() => Boolean)
  readonly shareable: boolean;

  @Field({
    description: 'the post body',
  })
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
