import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import * as migrations from './migrations';
import { PostLoader } from './post.loader';
import { PgPostRepository } from './post.pg.respository';
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
    PostRepository,
    PostableResolver,
    PostLoader,
    ...Object.values(migrations),
    splitDb(PostRepository, PgPostRepository),
  ],
  exports: [PostService],
})
export class PostModule {}
