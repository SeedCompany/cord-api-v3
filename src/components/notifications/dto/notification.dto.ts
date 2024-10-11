import { Field, InterfaceType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps } from '~/common';
import { LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource()
@InterfaceType({
  implements: [Resource],
})
export class Notification extends Resource {
  static readonly Props: string[] = keysOf<Notification>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Notification>>();

  readonly for: LinkTo<'User'>;

  @Field(() => Boolean)
  readonly unread: boolean;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Notification: typeof Notification;
  }
  // interface ResourceDBMap {
  //   Notification: typeof e.Notification;
  // }
}
