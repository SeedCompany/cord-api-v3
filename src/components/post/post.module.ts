import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { UserModule } from '../user/user.module';
import { PostLoader } from './post.loader';
import { PostRepository } from './post.repository';
import { PostResolver } from './post.resolver';
import { PostService } from './post.service';
import { PostableResolver } from './postable.resolver';

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
    PostLoader,
  ],
  exports: [PostService],
})
export class PostModule {}
