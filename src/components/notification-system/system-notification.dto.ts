import { Field, ObjectType } from '@nestjs/graphql';
import { MarkdownScalar } from '~/common/scalars/markdown.scalar';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Notification } from '../notifications';

@RegisterResource({ db: e.Notification.System })
@ObjectType({
  implements: [Notification],
})
export class SystemNotification extends Notification {
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
