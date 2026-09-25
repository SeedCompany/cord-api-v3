import { Field, ObjectType } from '@nestjs/graphql';
import { MarkdownScalar } from '~/common/scalars/markdown.scalar';
import { RegisterResource } from '~/core/resources';
import { Notification } from '../notifications';

@RegisterResource()
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
}
