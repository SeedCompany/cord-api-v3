import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { MarkdownScalar } from '~/common/markdown.scalar';
import { RegisterResource } from '~/core';
import { e } from '~/core/gel';
import { Notification } from '../notifications';

@RegisterResource({ db: e.Notification.System })
@ObjectType({
  implements: [Notification],
})
export class SystemNotification extends Notification {
  static readonly Props = keysOf<SystemNotification>();
  static readonly SecuredProps = keysOf<SecuredProps<SystemNotification>>();

  @Field(() => MarkdownScalar)
  readonly message: string;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    SystemNotification: typeof SystemNotification;
  }
  interface ResourceDBMap {
    SystemNotification: typeof e.Notification.System;
  }
}
