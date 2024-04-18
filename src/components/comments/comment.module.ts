import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { CommentThreadEdgeDBRepository } from './comment-thread.edgedb.repository';
import { CommentThreadLoader } from './comment-thread.loader';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentThreadResolver } from './comment-thread.resolver';
import { CommentEdgeDBRepository } from './comment.edgedb.repository';
import { CommentLoader } from './comment.loader';
import { CommentRepository } from './comment.repository';
import { CommentResolver } from './comment.resolver';
import { CommentService } from './comment.service';
import { CommentableResolver } from './commentable.resolver';
import { CreateCommentResolver } from './create-comment.resolver';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [
    CreateCommentResolver,
    CommentResolver,
    CommentLoader,
    splitDb(CommentRepository, CommentEdgeDBRepository),
    splitDb(CommentThreadRepository, CommentThreadEdgeDBRepository),
    CommentService,
    CommentThreadLoader,
    CommentableResolver,
    CommentThreadResolver,
  ],
  exports: [CommentService],
})
export class CommentModule {}
