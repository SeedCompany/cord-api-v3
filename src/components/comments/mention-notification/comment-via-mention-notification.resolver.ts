import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { CommentLoader } from '../comment.loader';
import { Comment } from '../dto';
import { CommentViaMentionNotification as Notification } from './comment-via-mention-notification.dto';

@Resolver(Notification)
export class CommentViaMentionNotificationResolver {
  @ResolveField(() => Comment)
  async comment(
    @Parent() { comment }: Notification,
    @Loader(CommentLoader) comments: LoaderOf<CommentLoader>,
  ) {
    return await comments.load(comment.id);
  }
}
