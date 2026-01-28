import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField, OptionalField } from '~/common';
import { Webhook } from '../../dto';

@ArgsType()
export class DeleteWebhookArgs {
  @IdField({ optional: true })
  id?: ID<'Webhook'>;

  @IdField({ optional: true })
  key?: ID<'Webhook'>;

  @NameField({ optional: true })
  name?: string;

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
