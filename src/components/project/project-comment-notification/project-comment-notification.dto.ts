import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, SecuredProps } from '~/common';
import { LinkTo } from '~/core/resources';
import { Notification } from '../../notifications';

@ObjectType({
  implements: [Notification],
})
export class ProjectCommentNotification extends Notification {
  static readonly Input: { comment: ID<'Comment'> } = undefined as any;
  static readonly Props = keysOf<ProjectCommentNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<ProjectCommentNotification>>();

  readonly comment: LinkTo<'Comment'>;

  readonly project: LinkTo<'Project'>;
}
