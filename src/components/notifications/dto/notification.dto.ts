import { Field, InterfaceType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import { DateTimeField, resolveByTypename, Resource } from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.default.Notification })
@InterfaceType({
  implements: [Resource],
  resolveType: resolveByTypename(Notification.name),
})
export class Notification extends Resource {
  @Field(() => Boolean, {
    description: 'Whether the notification is unread for the requesting user',
  })
  readonly unread: boolean;

  declare readonly __typename: string;

  @DateTimeField({
    nullable: true,
    description: 'When the notification was read for the requesting user',
  })
  readonly readAt: DateTime | null;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Notification: typeof Notification;
  }
  interface ResourceDBMap {
    Notification: typeof e.default.Notification;
  }
}
