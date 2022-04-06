import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { DtoRepository, Pg } from '../../../core';
import { paginate, sorting } from '../../../core/database/query';
import { PgTransaction } from '../../../core/postgres/transaction.decorator';
import {
  CreateUnavailability,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityPgRepository extends DtoRepository(Unavailability) {
  @Inject(Pg) private readonly pg: Pg;

  async create(input: CreateUnavailability, _session: Session) {
    const rows = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.person_unavailabilities(period_start, period_end, description, 
        admin_people_id, created_by_admin_people_id, modified_by_admin_people_id, 
        owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($1, $2, $3, $4, 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.start, input.end, input.description, input.userId]
    );
    if (!rows) {
      throw new ServerException('Failed to create unavailability');
    }
    return rows[0].id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<Unavailability>> {
    const rows = await this.pg.query<UnsecuredDto<Unavailability>>(
      `
      SELECT id, admin_people_id, period_start as "start", period_end as "end", description, 
      created_at as "createdAt", created_by_admin_people_id as "creator",
      modified_at as "modifiedAt", modified_by_admin_people_id
      FROM sc.person_unavailabilities
      WHERE id = $1;
      `,
      [id]
    );
    if (!rows[0]) {
      throw new NotFoundException(`Could not find unavailability id ${id}`);
    }
    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<Unavailability>>> {
    const rows = await this.pg.query<UnsecuredDto<Unavailability>>(
      `
      SELECT id, admin_people_id, period_start as "start", period_end as "end", description, 
      created_at as "createdAt", created_by_admin_people_id as "creator",
      modified_at as "modifiedAt", modified_by_admin_people_id
      FROM sc.person_unavailabilities
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );
    return rows;
  }

  @PgTransaction()
  async update(input: UpdateUnavailability, _session: Session) {
    await this.pg.query(
      `
      UPDATE sc.person_unavailabilities SET description = $2, period_start = $3, 
      period_end = $4, modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [input.id, input.description, input.start, input.end]
    );
  }

  async getUserIdByUnavailability(id: ID) {
    return { id };
  }

  async list(input: UnavailabilityListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'Unavailability')
      .apply(sorting(Unavailability, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate will always have 1 row.
  }
}
