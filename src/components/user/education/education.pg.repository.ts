import { Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { DtoRepository, Pg } from '../../../core';
import { ACTIVE, paginate, sorting } from '../../../core/database/query';
import { CreateEducation, Education, EducationListInput } from './dto';

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

  async getUserIdByEducation(id: ID) {
    return await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'education', ACTIVE),
        node('education', 'Education', { id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();
  }

  async list({ filter, ...input }: EducationListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'Education')
      .match([
        ...(filter.userId
          ? [
              node('node'),
              relation('in', '', 'education', ACTIVE),
              node('user', 'User', {
                id: filter.userId,
              }),
            ]
          : []),
      ])
      .apply(sorting(Education, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
