import { Inject, Injectable } from '@nestjs/common';
import { ID, ServerException, Session } from '../../common';
import { Pg } from '../../core';
import { CreatePost } from './dto';
import { PostRepository } from './post.repository';

//Adding PgPostRepository for the postgres migration effort
@Injectable()
export class PgPostRepository extends PostRepository {
  @Inject(Pg) private readonly pg: Pg;

  async create(
    input: CreatePost,
    session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.posts(type, shareability, body, created_by, modified_by, owning_person, owning_group)
      VALUES($1, $2, $3, $4, 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.type, input.shareability, input.body, session.userId]
    );
    if (!id) {
      throw new ServerException('Failed to create post');
    }

    return id;
  }
}
