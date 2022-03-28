import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import {
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  ObjectView,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { BudgetRecordRepository } from './budget-record.repository';
import {
  BudgetRecord,
  BudgetRecordListInput,
  CreateBudgetRecord,
  UpdateBudgetRecord,
} from './dto';

@Injectable()
export class PgBudgetRecordRepository
  implements PublicOf<BudgetRecordRepository>
{
  constructor(private readonly pg: Pg) {}

  async create(input: CreateBudgetRecord, _changeset?: ID): Promise<ID> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.budget_records(
          sc_budgets_id, fiscal_year, partnership, created_by_admin_people_id, 
          modified_by_admin_people_id, owning_person_admin_people_id, 
          owning_group_admin_groups_id)
      VALUES($1, $2, 
          (SELECT pr.id FROM sc.partners p, sc.partnerships pr 
            WHERE p.common_organizations_id = $3 AND p.id = pr.sc_partners_id), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.budgetId, input.fiscalYear, input.organizationId]
    );

    if (!id) {
      throw new ServerException('Failed to create budget record');
    }

    return id;
  }

  async doesRecordExist(input: CreateBudgetRecord): Promise<boolean> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `SELECT id FROM sc.budget_records WHERE sc_budgets_id = $1`,
      [input.budgetId]
    );

    return !!id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<BudgetRecord>> {
    const rows = await this.pg.query<UnsecuredDto<BudgetRecord>>(
      `
      SELECT 
          br.id, br.fiscal_year as "fiscalYear", br.amount, br.created_at as "createdAt", 
          p.common_organizations_id as "organization"
      FROM sc.budget_records br, sc.partnerships pr
      JOIN sc.partners p ON pr.sc_partners_id = p.id
      WHERE br.id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find budget record ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<BudgetRecord>>> {
    const rows = await this.pg.query<UnsecuredDto<BudgetRecord>>(
      `
      SELECT DISTINCT 
          br.id, br.fiscal_year as "fiscalYear", br.amount, br.created_at as "createdAt", 
          p.common_organizations_id as "organization"
      FROM sc.budget_records br, sc.partnerships pr
      JOIN sc.partners p ON pr.sc_partners_id = p.id
      WHERE br.id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: BudgetRecordListInput,
    _session: Session,
    _view?: ObjectView
  ): Promise<PaginatedListType<ID>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.budget_records;
      `
    );

    const rows = await this.pg.query<ID>(
      `
      SELECT id
      FROM sc.budget_records
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const budgetRecordList: PaginatedListType<ID> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return budgetRecordList;
  }

  async update(input: UpdateBudgetRecord) {
    const { id, amount } = input;
    amount &&
      (await this.pg.query(
        `
      UPDATE sc.budget_records SET amount = ${amount}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
        [id]
      ));
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.budget_records WHERE id = $1', [id]);
  }

  hydrate(): (query: Query) => Query<{ dto: UnsecuredDto<BudgetRecord> }> {
    throw new Error('Method not implemented.');
  }

  recordsOfBudget(_input: {
    budgetVar?: string | undefined;
    view?: ObjectView | undefined;
    outputVar?: string | undefined;
  }): (query: Query) => Query {
    throw new Error('Method not implemented.');
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof BudgetRecord>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof BudgetRecord>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<BudgetRecord>,
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
  checkDeletePermission(_id: ID, _session: ID | Session): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
