import { Field, InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { DateTimeField, Resource, SecuredProps } from '~/common';
import { RegisterResource } from '~/core/resources';

@RegisterResource()
@InterfaceType({
  implements: [Resource],
})
export class Notification extends Resource {
  static readonly Props: string[] = keysOf<Notification>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Notification>>();

  @Field(() => Boolean, {
    description: 'Whether the notification is unread for the requesting user',
  })
  readonly unread: boolean;

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
  // interface ResourceDBMap {
  //   Notification: typeof e.Notification;
  // }
}
