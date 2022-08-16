import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, RichTextField } from '../../../common';
import { Comment } from './comment.dto';

@InputType()
export class CreateComment {
  @IdField()
  readonly threadId: ID;

  @RichTextField()
  readonly body: string;
}

@InputType()
export abstract class CreateCommentInput {
  @Field()
  @Type(() => CreateComment)
  @ValidateNested()
  readonly comment: CreateComment;
}

@ObjectType()
export abstract class CreateCommentOutput {
  @Field()
  readonly comment: Comment;
}
