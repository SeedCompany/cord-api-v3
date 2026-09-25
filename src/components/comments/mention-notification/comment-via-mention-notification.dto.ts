import { ObjectType } from '@nestjs/graphql';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Notification } from '../../notifications';

@RegisterResource()
@ObjectType({
  implements: [Notification],
})
export class CommentViaMentionNotification extends Notification {
  readonly comment: LinkTo<'Comment'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentMentionedNotification: typeof CommentViaMentionNotification;
  }
}
