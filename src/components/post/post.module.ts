import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { PostResolver } from './post.resolver';
import { PostService } from './post.service';
import { PostRepository } from './post.repository';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [PostResolver, PostService, PostRepository],
  exports: [PostService, PostRepository],
})
export class PostModule {}
