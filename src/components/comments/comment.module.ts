import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { NotificationModule } from '../notifications';
import { UserModule } from '../user/user.module';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentThreadResolver } from './comment-thread.resolver';
import { CommentLoader } from './comment.loader';
import { CommentRepository } from './comment.repository';
import { CommentResolver } from './comment.resolver';
import { CommentService } from './comment.service';
import { CommentableResolver } from './commentable.resolver';
import { CreateCommentResolver } from './create-comment.resolver';
import { CommentViaMembershipNotificationModule } from './membership-notification/membership-notification.module';
import { CommentViaMentionNotificationModule } from './mention-notification/comment-via-mention-notification.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    forwardRef(() => NotificationModule),
    CommentViaMentionNotificationModule,
    CommentViaMembershipNotificationModule,
  ],
  providers: [
    CreateCommentResolver,
    CommentResolver,
    CommentLoader,
    CommentRepository,
    CommentThreadRepository,
    CommentService,
    CommentThreadLoader,
    CommentableResolver,
    CommentThreadResolver,
  ],
  exports: [CommentService],
})
export class CommentModule {}
