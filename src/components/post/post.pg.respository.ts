import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { ILogger, Logger, Pg } from '../../core';
import { CreatePost, Post } from './dto';
import { PostRepository } from './post.repository';

//Adding PgPostRepository for the postgres migration effort
@Injectable()
export class PgPostRepository extends PostRepository {
  @Inject(Pg) private readonly pg: Pg;
  @Logger('post:pg.repository') private readonly logger: ILogger;

  async create(
    input: CreatePost,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.posts(type, shareability, body, created_by, modified_by, owning_person, owning_group)
      VALUES($1, $2, $3, (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.type, input.shareability, input.body]
    );
    if (!id) {
      throw new ServerException('Failed to create post');
    }

    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<Post>> {
    const rows = await this.pg.query<UnsecuredDto<Post>>(
      `
      SELECT id, directory, type, shareability, body, created_at as "createdAt", modified_at as "modifiedAt"
      FROM sc.posts
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find post ${id}`);
    }

    return rows[0];
  }
}
