import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { OptionalField, PartialType, PickType } from '~/common';
import { Webhook } from '../../dto';

@ArgsType()
export class DeleteWebhookArgs extends PartialType(
  PickType(Webhook, ['id', 'key', 'name']),
) {
  @OptionalField(() => Boolean, {
    description: 'Delete all webhooks for the requesting user',
  })
  readonly all?: boolean;
}

@ObjectType()
export class WebhooksDeleted {
  @Field(() => [Webhook])
  readonly deleted: readonly Webhook[];
}
