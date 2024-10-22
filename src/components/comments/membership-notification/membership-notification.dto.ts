import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, SecuredProps } from '~/common';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { Notification } from '../../notifications';

@RegisterResource({ db: e.Notification.CommentViaMembership })
@ObjectType({
  implements: [Notification],
})
export class CommentViaMembershipNotification extends Notification {
  static readonly Input: {
    comment: ID<'Comment'>;
    mentionees: ReadonlyArray<ID<'User'>>;
  } = undefined as any;
  static readonly Props = keysOf<CommentViaMembershipNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<CommentViaMembershipNotification>>();

  readonly comment: LinkTo<'Comment'>;

  readonly project: LinkTo<'Project'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentViaMembershipNotification: typeof CommentViaMembershipNotification;
  }
  interface ResourceDBMap {
    CommentViaMembershipNotification: typeof e.Notification.CommentViaMembership;
  }
}
