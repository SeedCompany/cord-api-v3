import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { PostModerationDrizzleRepository } from './post-moderation.drizzle.repository';
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
    // Also registered directly (not just via splitDb above) so the service
    // can inject it for the Investor Report featured-count cap — Postgres-only.
    PostDrizzleRepository,
    PostableResolver,
    PostLoader,
    // Not split by backend: moderation is Postgres-only by design.
    PostModerationDrizzleRepository,
  ],
  exports: [PostService],
})
export class PostModule {}
