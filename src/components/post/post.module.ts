import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { UserModule } from '../user/user.module';
import { PostLoader } from './post.loader';
import { PostRepository } from './post.repository';
import { PostResolver } from './post.resolver';
import { PostService } from './post.service';
import { PostableResolver } from './postable.resolver';
import {
  GtlReportPostsResolver,
  ProgressReportPostsResolver,
} from './report-posts.resolver';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    // For the `Post.report` field, resolved through the PeriodicReportLoader.
    forwardRef(() => PeriodicReportModule),
  ],
  providers: [
    PostResolver,
    PostService,
    PostRepository,
    PostableResolver,
    GtlReportPostsResolver,
    ProgressReportPostsResolver,
    PostLoader,
  ],
  exports: [PostService],
})
export class PostModule {}
