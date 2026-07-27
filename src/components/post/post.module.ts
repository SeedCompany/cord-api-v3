import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { PostDrizzleRepository } from './post.drizzle.repository';
import { PostLoader } from './post.loader';
import { PostRepository } from './post.repository';
import { PostResolver } from './post.resolver';
import { PostService } from './post.service';
import { PostableResolver } from './postable.resolver';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [
    PostResolver,
    PostService,
    // migration-todo: drop the `as any` + the Neo4j path at Phase 7 cutover.
    splitDb(PostRepository, {
      postgres: PostDrizzleRepository as any,
    }),
    PostableResolver,
    PostLoader,
  ],
  exports: [PostService],
})
export class PostModule {}
