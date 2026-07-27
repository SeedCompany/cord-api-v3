import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { CommentThreadDrizzleRepository } from './comment-thread.drizzle.repository';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentThreadResolver } from './comment-thread.resolver';
import { CommentDrizzleRepository } from './comment.drizzle.repository';
import { CommentLoader } from './comment.loader';
import { CommentRepository } from './comment.repository';
import { CommentResolver } from './comment.resolver';
import { CommentService } from './comment.service';
import { CommentableResolver } from './commentable.resolver';
import { CreateCommentResolver } from './create-comment.resolver';
import { CommentViaMentionNotificationModule } from './mention-notification/comment-via-mention-notification.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    CommentViaMentionNotificationModule,
  ],
  providers: [
    CreateCommentResolver,
    CommentResolver,
    CommentLoader,
    // Only the comment repo is routed through splitDb. The CommentThread token
    // is consumed solely by the Neo4j comment repo, so it stays a plain
    // provider; the Drizzle comment repo injects the Drizzle thread repo
    // concretely. Routing both through splitDb would deadlock moduleRef.create
    // on the Neo4j repos' mutual forwardRef cycle.
    // migration-todo: drop the `as any` + the Neo4j path at Phase 7 cutover.
    splitDb(CommentRepository, {
      postgres: CommentDrizzleRepository as any,
    }),
    CommentThreadRepository,
    CommentThreadDrizzleRepository,
    CommentService,
    CommentThreadLoader,
    CommentableResolver,
    CommentThreadResolver,
  ],
  exports: [CommentService],
})
export class CommentModule {}
