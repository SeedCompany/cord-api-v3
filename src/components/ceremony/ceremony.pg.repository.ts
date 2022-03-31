import { Injectable } from '@nestjs/common';
import { isEmpty, isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { CeremonyRepository } from './ceremony.repository';
import {
  Ceremony,
  CeremonyListInput,
  CreateCeremony,
  UpdateCeremony,
} from './dto';

@Injectable()
export class PgCeremonyRepository implements PublicOf<CeremonyRepository> {
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreateCeremony,
    _session?: Session,
    engagementId?: ID
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.ceremonies(
        sc_engagements_id, actual_date, estimated_date, is_planned, type, created_by_admin_people_id, 
        modified_by_admin_people_id, owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES ($1, $2, $3, $4, $5, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        engagementId,
        input.actualDate,
        input.estimatedDate,
        input.planned,
        input.type,
      ]
    );

    return id;
  }

  async readOne(id: ID, _session: Session): Promise<UnsecuredDto<Ceremony>> {
    const rows = await this.pg.query<UnsecuredDto<Ceremony>>(
      `
      SELECT 
        id, actual_date as "actualDate", estimated_date as "estimatedDate", is_planned as planned,
        type, created_at as "createdAt"
      FROM sc.ceremonies
      WHERE id = $1;
      `,
      [id]
    );

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session: Session
  ): Promise<ReadonlyArray<UnsecuredDto<Ceremony>>> {
    const rows = await this.pg.query<UnsecuredDto<Ceremony>>(
      `
      SELECT 
        id, actual_date as "actualDate", estimated_date as "estimatedDate", is_planned as planned,
        type, created_at as "createdAt"
      FROM sc.ceremonies
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async list(
    { filter, ...input }: CeremonyListInput,
    _session: Session,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<PaginatedListType<UnsecuredDto<Ceremony>>> {
    // TODO: Match AuthSensitivityMapping and filters
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.ceremonies;
      `
    );

    const rows = await this.pg.query<UnsecuredDto<Ceremony>>(
      `
      SELECT 
        id, actual_date as "actualDate", estimated_date as "estimatedDate", is_planned as planned,
        type, created_at as "createdAt"
      FROM sc.ceremonies
      ORDER BY created_at ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    const ceremoniesList: PaginatedListType<UnsecuredDto<Ceremony>> = {
      items: rows,
      total: +count,
      hasMore: rows.length > +count,
    };

    return ceremoniesList;
  }

  async update(input: UpdateCeremony) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    if (isEmpty(changes)) {
      return;
    }

    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'planned'
          ? `is_planned = ${value as string}`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.ceremonies SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [id]
    );
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.ceremonies WHERE id = $1', [id]);
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Ceremony>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;
  isUnique(_value: string, _label?: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }

  updateProperties<
    TObject extends Partial<MaybeUnsecuredInstance<typeof Ceremony>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<Ceremony>,
    _changeset?: ID
  ): Promise<TObject> {
    throw new Error('Method not implemented.');
  }
  updateRelation(
    _relationName: string,
    _otherLabel: string,
    _id: ID,
    _otherId: ID | null
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  checkDeletePermission(_id: ID, _session: Session | ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
