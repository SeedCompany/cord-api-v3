import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { Post } from './dto';
import { PostService } from './post.service';

@LoaderFactory()
export class PostLoader extends OrderedNestDataLoader<Post> {
  constructor(private readonly posts: PostService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.posts.readMany(ids, this.session);
  }
}
