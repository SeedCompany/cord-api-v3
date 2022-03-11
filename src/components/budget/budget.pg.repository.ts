import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import {
  ID,
  MaybeUnsecuredInstance,
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
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { BudgetRepository } from './budget.repository';
import {
  Budget,
  BudgetListInput,
  BudgetRecord,
  CreateBudget,
  BudgetStatus as Status,
  UpdateBudget,
} from './dto';

@Injectable()
export class PgBudgetRepository implements PublicOf<BudgetRepository> {
  constructor(private readonly pg: Pg) {}

  async doesProjectExist(projectId: ID, _session: Session): Promise<boolean> {
    const rows = await this.pg.query(
      'SELECT id FROM sc.projects WHERE id = $1',
      [projectId]
    );

    return !!rows[0];
  }

  async create(
    input: CreateBudget,
    _universalTemplateFileId: ID,
    _session: Session
  ): Promise<ID> {
    // TODO: Add universal_template
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.budgets(project, status, created_by, modified_by, 
                            owning_person, owning_group)
      VALUES ($1, $2, (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.projectId, Status.Pending]
    );

    if (!id) {
      throw new ServerException('Failed to create budget');
    }

    return id;
  }

  async readOne(
    id: ID,
    _session?: Session,
    _view?: ObjectView | undefined
  ): Promise<UnsecuredDto<Budget>> {
    const rows = await this.pg.query<UnsecuredDto<Budget>>(
      `
      SELECT id, status, sensitivity, universal_template as "universalTemplateFile",
            created_at as "createdAt"
      FROM sc.budgets
      WHERE id = $1;
      `,
      [id]
    );

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session?: Session,
    _view?: ObjectView
  ): Promise<ReadonlyArray<UnsecuredDto<Budget>>> {
    const rows = await this.pg.query<UnsecuredDto<Budget>>(
      `
      SELECT id, status, sensitivity, universal_template as "universalTemplateFile",
            created_at as "createdAt"
      FROM sc.budgets
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async getStatusByRecord(recordId: ID): Promise<Status> {
    const [{ status }] = await this.pg.query<{ status: Status }>(
      `
      SELECT b.status
      FROM sc.budgets b, sc.budget_records br
      WHERE br.budget = b.id AND br.id = $1;
      `,
      [recordId]
    );

    return status;
  }

  async list(
    { filter, ...input }: BudgetListInput,
    _session: Session,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<PaginatedListType<ID>> {
    // TODO: Match AuthSensitivityMapping
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.budgets;
      `
    );

    const rows = await this.pg.query<ID>(
      `
      SELECT id
      FROM sc.budgets
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const budgetList: PaginatedListType<ID> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return budgetList;
  }

  async listUnsecure({
    filter,
    ...input
  }: BudgetListInput): Promise<PaginatedListType<ID>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.budgets;
      `
    );

    const rows = await this.pg.query<ID>(
      `
      SELECT id
      FROM sc.budgets
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const budgetList: PaginatedListType<ID> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return budgetList;
  }

  async update(input: UpdateBudget) {
    const { id, ...changes } = input;
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label.endsWith('File')
          ? `universal_template = '${value as string}'`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.budgets SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [id]
    );
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.budget_records WHERE budget = $1;', [
      id,
    ]);
    await this.pg.query('DELETE FROM sc.budgets WHERE id = $1;', [id]);
  }

  currentBudgetForProject(
    _projectId: ID,
    _changeset?: ID
  ): (query: Query) => Query {
    throw new Error('Method not implemented.');
  }

  listRecordsForSync(
    _projectId: ID,
    _session: Session,
    _changeset?: ID
  ): Promise<
    UnsecuredDto<Pick<Budget, 'status' | 'id'>> & {
      records: ReadonlyArray<UnsecuredDto<BudgetRecord>>;
    }
  > {
    throw new Error('Method not implemented.');
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Budget>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof Budget>> & { id: ID }
  >(
    _object: TObject,
    _changes: DbChanges<Budget>,
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
