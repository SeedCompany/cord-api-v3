import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { type Post } from './dto';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@LoaderFactory()
export class PostLoader implements DataLoaderStrategy<Post, ID<Post>> {
  constructor(
    private readonly service: PostService,
    private readonly repo: PostRepository,
  ) {}

  async loadMany(ids: ReadonlyArray<ID<Post>>) {
    const posts = await this.repo.readMany(ids);

    const parentRefs = new Map(
      posts.map((post) => [post.parent.id, post.parent]),
    );
    const parents = new Map(
      await Promise.all(
        [...parentRefs].map(async ([id, ref]) => {
          const parent = await this.service.getPermissionsFromPostable(ref);
          return [id, parent] as const;
        }),
      ),
    );

    return posts.map((dto) => {
      try {
        parents.get(dto.parent.id)!.verifyCan('read');
      } catch (error) {
        return { key: dto.id, error };
      }
      return this.service.secure(dto);
    });
  }
}
