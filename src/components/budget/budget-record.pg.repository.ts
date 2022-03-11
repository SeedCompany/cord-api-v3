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
      INSERT INTO sc.budget_records(budget, organization, fiscal_year, created_by, 
                                modified_by, owning_person, owning_group)
      VALUES($1, $2, $3, (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.budgetId, input.organizationId, input.fiscalYear]
    );

    if (!id) {
      throw new ServerException('Failed to create budget record');
    }

    return id;
  }

  async doesRecordExist(input: CreateBudgetRecord): Promise<boolean> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `SELECT id FROM sc.budget_records WHERE budget = $1`,
      [input.budgetId]
    );

    return !!id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<BudgetRecord>> {
    const rows = await this.pg.query<UnsecuredDto<BudgetRecord>>(
      `
      SELECT id, organization, fiscal_year as "fiscalYear", amount, created_at as "createdAt"
      FROM sc.budget_records
      WHERE id = $1
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
      SELECT id, organization, fiscal_year as "fiscalYear", amount, created_at "createdAt"
      FROM sc.budget_records
      WHERE id = ANY($1::text[]);
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
    await this.pg.query(
      `
      UPDATE sc.budget_records SET amount = ${amount!}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [id]
    );
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
