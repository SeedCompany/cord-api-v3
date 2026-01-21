import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IntersectTypes, PartialType, PickType } from '~/common';
import { Webhook } from '../../dto';

@InputType()
export class WebhookConfig extends IntersectTypes(
  PickType(Webhook, ['subscription', 'variables', 'url', 'metadata']),
  PartialType(PickType(Webhook, ['key'])),
) {}

@ObjectType()
export class WebhookSaved {
  @Field()
  webhook: Webhook;
}
