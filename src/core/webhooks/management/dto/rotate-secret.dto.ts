import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RotateWebhookSecretOutput {
  @Field()
  secret: string;
}
