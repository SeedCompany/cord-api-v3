import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  PaginatedListType,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import { CreatePost, Post, UpdatePost } from './dto';
import { PostListInput } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

@Injectable()
export class PgPostRepository extends PostRepository {
  @Inject(Pg) private readonly pg: Pg;

  async create(
    input: CreatePost,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.posts(type, shareability, body, created_by_admin_people_id, modified_by_admin_people_id, owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($1, $2, $3, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
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
      SELECT id, created_by_admin_people_id as "creator", type, shareability, body, created_at as "createdAt", modified_at as "modifiedAt"
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

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<Post>>> {
    const rows = await this.pg.query<UnsecuredDto<Post>>(
      `
      SELECT id, created_by_admin_people_id as "creator", type, shareability, body, created_at as "createdAt", modified_at as "modifiedAt"
      FROM sc.posts
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.posts WHERE id = $1', [id]);
  }

  async list(
    input: PostListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<Post>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM sc.posts;'
    );

    const rows = await this.pg.query<UnsecuredDto<Post>>(
      `
      SELECT id, created_by_admin_people_id as "creator", type, shareability, body, created_at as "createdAt", modified_at as "modifiedAt"
      FROM sc.posts
      ORDER BY created_at ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );
    return {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };
  }

  @PgTransaction()
  async update(input: UpdatePost, _session: Session) {
    await this.pg.query(
      `
      UPDATE sc.posts SET body = $2, type = $3, shareability = $4, modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [input.id, input.body, input.type, input.shareability]
    );
  }
}
