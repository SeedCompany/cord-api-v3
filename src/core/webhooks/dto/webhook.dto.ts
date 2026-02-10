import { Field, ID as IDType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLJSONObject } from 'graphql-scalars';
import { DateTime } from 'luxon';
import { type ID, IdField, NameField, UrlField } from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { GraphqlDocumentScalar } from './graphql-document.scalar';

@RegisterResource()
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

  // Not using IDField here because the value is user-provided, so it should
  // not follow our usual ID encoding rules. Consider changing to raw String.
  @Field(() => IDType, {
    description: stripIndent`
      The unique key/ID (per user) of the webhook.

      Defaults to the given operation's name, but can also be given directly.
      Use this key to update the webhook info with subsequent register mutations.
    `,
  })
  key: ID<'Webhook'>;

  owner: LinkTo<'User'>;

  @NameField({
    description:
      'The name of the webhook. Defined from the operation or the given key.',
  })
  name: string;

  @Field(() => GraphqlDocumentScalar, {
    description: stripIndent`
      A GraphQL document with a subscription operation.
      This describes what will be POSTed to the given url.
    `,
  })
  subscription: string;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'Variables for the operation given',
  })
  variables?: Record<string, unknown>;

  @UrlField({
    description: 'The url which we will POST subscription events to',
  })
  url: string;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: stripIndent`
      Any metadata to help facilitate management of the webhook on the consumer side.

      This can be viewed on the webhook and we will send it with each POST request
      in the body's \`extensions.userMetadata\`.
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

      This is enforced when saving a webhook, but if our schema changes it
      could cause the webhook document to become invalid.
      We'll POST this validation error to the webhook URL, with the same
      extensions normally sent (to identity the webhook), and with the same
      \`error\` info you'd get back from \`saveWebhook\`.
      After this happens we'll no longer consider this webhook valid, and it
      won't receive any further events.
      This can be reset with another save mutation providing a updated operation.
    `,
  })
  valid: boolean;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Webhook: typeof Webhook;
  }
}
