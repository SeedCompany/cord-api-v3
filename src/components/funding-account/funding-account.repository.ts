import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { isEmpty, isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository, Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import {
  createNode,
  matchRequestingUser,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  UpdateFundingAccount,
} from './dto';

@Injectable()
export class FundingAccountRepository extends DtoRepository(FundingAccount) {
  async create(input: CreateFundingAccount, session: Session) {
    const initialProps = {
      name: input.name,
      accountNumber: input.accountNumber,
      canDelete: true,
    };
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(FundingAccount, { initialProps }))
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async list(input: FundingAccountListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match(node('node', 'FundingAccount'))
      .apply(sorting(FundingAccount, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}

@Injectable()
export class PgFundingAccountRepository
  implements PublicOf<FundingAccountRepository>
{
  constructor(readonly pg: Pg) {}
  async create(
    input: CreateFundingAccount,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.funding_accounts(account_number, name, 
        created_by, modified_by, owning_person, owning_group)
      VALUES($1, $2, (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators')) 
      RETURNING id;
      `,
      [input.accountNumber, input.name]
    );

    if (!id) {
      throw new ServerException('Failed to create funding account');
    }

    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<FundingAccount>> {
    const rows = await this.pg.query<UnsecuredDto<FundingAccount>>(
      `
      SELECT id, name, account_number as accountNumber, created_at as "createdAt"
      FROM sc.funding_accounts WHERE id = $1
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find funding account ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<FundingAccount>>> {
    const rows = await this.pg.query<UnsecuredDto<FundingAccount>>(
      `
      SELECT id, name, account_number as accountNumber, created_at as "createdAt"
      FROM sc.funding_accounts WHERE id = ANY($1::text[])
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: FundingAccountListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<FundingAccount>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM sc.funding_accounts'
    );

    const rows = await this.pg.query<UnsecuredDto<FundingAccount>>(
      `
      SELECT id, name, account_number as accountNumber, created_at as "createdAt"
      FROM sc.funding_accounts
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    return {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };
  }

  async update(input: UpdateFundingAccount) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    if (isEmpty(changes)) {
      return;
    }

    const updates = Object.keys(changes)
      .map((key) =>
        key === 'accountNumber'
          ? `account_number = ${changes.accountNumber as number}`
          : `${key} = '${changes[key] as string}'`
      )
      .join(', ');

    const rows = await this.pg.query<{ id: ID }>(
      `
      UPDATE sc.funding_accounts SET ${updates}, modified_at = CURRENT_TIMESTAMP, 
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new ServerException(`Could not update funding account ${id}`);
    }

    return rows[0];
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.funding_accounts WHERE id = $1', [id]);
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof FundingAccount>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof FundingAccount>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<FundingAccount>,
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
