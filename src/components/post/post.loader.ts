import { ID } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { Post } from './dto';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@LoaderFactory()
export class PostLoader extends SessionAwareLoaderStrategy<Post> {
  constructor(
    private readonly service: PostService,
    private readonly repo: PostRepository,
  ) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    const session = this.session;

    const posts = await this.repo.readMany(ids, session);

    const parentIds = new Set(posts.map((post) => post.parent.properties.id));
    const parents = new Map(
      await Promise.all(
        [...parentIds].map(async (id) => {
          const parent = await this.service.getPermissionsFromPostable(
            id,
            session,
          );
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
      return this.service.secure(dto, session);
    });
  }
}
