import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';

@InputType()
export abstract class CreateProjectCommentNotificationInput {
  @IdField()
  readonly commentId: ID<'Comment'>;

  @IdField()
  readonly projectId: ID<'Project'>;
}

@ObjectType()
export abstract class CreateProjectCommentNotificationOutput {
  @Field()
  readonly content?: string;
}
