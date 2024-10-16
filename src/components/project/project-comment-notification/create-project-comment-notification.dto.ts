import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export abstract class CreateProjectCommentNotificationOutput {
  @Field()
  readonly content?: string;
}
