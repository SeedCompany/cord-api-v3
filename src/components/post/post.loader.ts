import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { type Post } from './dto';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@LoaderFactory()
export class PostLoader implements DataLoaderStrategy<Post, ID<Post>> {
  constructor(private readonly service: PostService, private readonly repo: PostRepository) {}

  async loadMany(ids: ReadonlyArray<ID<Post>>) {
    const posts = await this.repo.readMany(ids);

    const parentIds = new Set(posts.map((post) => post.parent.properties.id));
    const parents = new Map(
      await Promise.all(
        [...parentIds].map(async (id) => {
          const parent = await this.service.getPermissionsFromPostable(id);
          return [id, parent] as const;
        }),
      ),
    );

    return posts.map((dto) => {
      try {
        parents.get(dto.parent.properties.id)!.verifyCan('read');
      } catch (error) {
        return { key: dto.id, error };
      }
      return this.service.secure(dto);
    });
  }
}
