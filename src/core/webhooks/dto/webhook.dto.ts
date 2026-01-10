import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLJSONObject } from 'graphql-scalars';
import { DateTime } from 'luxon';
import { type ID, IdField, UrlField } from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource()
@InputType({ isAbstract: true })
@ObjectType({
  description: stripIndent`
    A webhook is a subscription to a GraphQL operation that will POST events to a given URL.
    Just as SSE is used for subscriptions in browsers,
    these Webhooks are used for subscriptions in servers.
  `,
})
export class Webhook {
  @IdField()
  id: ID<'Webhook'>;

  @IdField({
    description: stripIndent`
      The unique key/ID (per user) of the webhook.

      Defaults to the given operation's name, but can also be given directly.
      Use this key to update the webhook info with subsequent register mutations.
    `,
  })
  key: ID<'Webhook'>;

  owner: LinkTo<'User'>;

  @Field({
    description: 'The name of the webhook. Defined from the operation.',
  })
  name: string;

  @Field({
    description: stripIndent`
      A GraphQL document with a subscription operation.
      This describes what will be POSTed to the given url.
    `,
  })
  document: string;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Variables for the operation given',
  })
  variables?: Record<string, any>;

  @UrlField({
    description: 'The url which we will POST subscription events to',
  })
  url: string;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: stripIndent`
      Any user metadata that we will be sent with each POST request
      in the body's \`extensions.userMetadata\`.

      This can be used to pass additional information to the webhook consumer.
    `,
  })
  metadata?: Record<string, unknown>;

  @Field({
    description: stripIndent`
      A secret which should be used to verify received webhook requests.

      Currently this is shared amongst all webhooks for the user.
    `,
  })
  secret: string;

  @Field()
  createdAt: DateTime;

  @Field()
  modifiedAt: DateTime;

  @Field({
    description: stripIndent`
      Whether the webhook is currently valid.

      This is enforced when upserting a webhook, but if our schema changes it
      could cause the webhook document to become invalid.
      We'll POST this validation error to the webhook URL, with the same
      extensions normally sent (to identity the webhook), and with the same
      \`error\` info you'd get back from \`upsertWebhook\`.
      After this happens we'll no longer consider this webhook valid, and it
      won't receive any further events.
      This can be reset with another upsert mutation providing a updated operation.
    `,
  })
  valid: boolean;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Webhook: typeof Webhook;
  }
}
