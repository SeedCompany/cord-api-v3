import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WebhookSecretRotated {
  @Field()
  secret: string;
}
