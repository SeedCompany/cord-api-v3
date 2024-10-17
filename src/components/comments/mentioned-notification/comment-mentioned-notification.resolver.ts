import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf, ResourceLoader } from '~/core';
import { CommentLoader } from '../comment.loader';
import { Comment } from '../dto';
import { CommentMentionedNotification as Mentioned } from './comment-mentioned-notification.dto';

@Resolver(Mentioned)
export class CommentMentionedNotificationResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField(() => Comment)
  async comment(
    @Parent() { comment }: Mentioned,
    @Loader(CommentLoader) comments: LoaderOf<CommentLoader>,
  ) {
    return await comments.load(comment.id);
  }
}
