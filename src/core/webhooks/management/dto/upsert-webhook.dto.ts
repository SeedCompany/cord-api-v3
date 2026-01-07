import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IntersectTypes, PartialType, PickType } from '~/common';
import { Webhook } from '../../dto';

@InputType()
export class UpsertWebhookInput extends IntersectTypes(
  PickType(Webhook, ['document', 'variables', 'url', 'metadata']),
  PartialType(PickType(Webhook, ['key'])),
) {}

@ObjectType()
export class UpsertWebhookOutput {
  @Field()
  webhook: Webhook;
}
