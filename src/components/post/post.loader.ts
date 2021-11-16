import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Post } from './dto';
import { PostService } from './post.service';

@Injectable({ scope: Scope.REQUEST })
export class PostLoader extends OrderedNestDataLoader<Post> {
  constructor(private readonly posts: PostService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.posts.readMany(ids, this.session);
  }
}
