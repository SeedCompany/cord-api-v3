import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  PaginatedListType,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { DtoRepository, Pg } from '../../../core';
import { PgTransaction } from '../../../core/postgres/transaction.decorator';
import {
  CreateEducation,
  Education,
  EducationListInput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationPgRepository extends DtoRepository(Education) {
  @Inject(Pg) private readonly pg: Pg;

  async create(input: CreateEducation, _session: Session) {
    const rows = await this.pg.query<{ id: ID }>(
      `
      WITH common_education AS (
        INSERT INTO common.education_entries(degree, institution, major, 
            created_by_admin_people_id, modified_by_admin_people_id, 
            owning_person_admin_people_id, owning_group_admin_groups_id)
          VALUES($1, $2, $3, 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
              (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
          RETURNING id as common_education_id
      )
      INSERT INTO common.education_by_person(
        admin_people_id, education_common_education_entries_id, 
        created_by_admin_people_id, modified_by_admin_people_id, 
        owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($4, (SELECT common_education_id FROM common_education),
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING (SELECT common_education_id FROM common_education) as id
      `,
      [input.degree, input.institution, input.major, input.userId]
    );
    if (!rows) {
      throw new ServerException('Failed to create education entry');
    }
    return rows[0];
  }

  async readOne(id: ID): Promise<UnsecuredDto<Education>> {
    const rows = await this.pg.query<UnsecuredDto<Education>>(
      `
      SELECT id, degree, institution, major, created_at as "createdAt"
      FROM common.education_entries
      WHERE id = $1;
      `,
      [id]
    );
    if (!rows[0]) {
      throw new NotFoundException(`Could not find education_entry id ${id}`);
    }
    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<Education>>> {
    const rows = await this.pg.query<UnsecuredDto<Education>>(
      `
      SELECT id, degree, institution, major, created_at as "createdAt"
      FROM common.education_entries
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );
    return rows;
  }

  async getUserIdByEducation(id: ID) {
    const rows = await this.pg.query<{ id: ID }>(
      `
      SELECT admin_people_id as "id"
      FROM common.education_by_person
      WHERE education_common_education_entries_id = $1;
      `,
      [id]
    );
    if (!rows) {
      throw new NotFoundException(
        `Could not find education_by_person entry for education id: ${id}`
      );
    }
    return rows[0];
  }

  async list(
    input: EducationListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<Education>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;
    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM common.education_entries;'
    );

    const rows = await this.pg.query<UnsecuredDto<Education>>(
      `
      SELECT id, degree, institution, major, created_at as "createdAt"
      FROM common.education_entries
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
  async update(input: UpdateEducation, _session: Session) {
    await this.pg.query(
      `
      UPDATE common.education_entries SET degree = $2, institution = $3, 
      major = $4, modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [input.id, input.degree, input.institution, input.major]
    );
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query(
      `
     WITH deleted_rows AS (
        DELETE FROM common.education_by_person WHERE education_common_education_entries_id = $1
     )
     DELETE FROM common.education_entries WHERE id = $1`,
      [id]
    );
  }
}
