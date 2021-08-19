import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import * as migrations from './migrations';
import { PostRepository } from './post.repository';
import { PostResolver } from './post.resolver';
import { PostService } from './post.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [
    PostResolver,
    PostService,
    PostRepository,
    ...Object.values(migrations),
  ],
  exports: [PostService],
})
export class PostModule {}
