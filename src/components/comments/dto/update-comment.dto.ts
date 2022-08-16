import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, RichTextField } from '../../../common';
import { Comment } from './comment.dto';

@InputType()
export abstract class UpdateComment {
  @IdField()
  readonly id: ID;

  @RichTextField()
  readonly body: string;
}

@InputType()
export abstract class UpdateCommentInput {
  @Field()
  @Type(() => UpdateComment)
  @ValidateNested()
  readonly comment: UpdateComment;
}

@ObjectType()
export abstract class UpdateCommentOutput {
  @Field()
  readonly comment: Comment;
}
