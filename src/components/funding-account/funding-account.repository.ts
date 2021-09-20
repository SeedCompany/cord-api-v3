import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import {
  DatabaseService,
  DtoRepository,
  matchRequestingUser,
  PostgresService,
} from '../../core';
import {
  createNode,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
} from './dto';

@Injectable()
export class FundingAccountRepository extends DtoRepository(FundingAccount) {
  constructor(db: DatabaseService, private readonly pg: PostgresService) {
    super(db);
  }
  async checkFundingAccount(name: string) {
    return await this.db
      .query()
      .match([node('fundingAccount', 'FieldZoneName', { value: name })])
      .return('fundingAccount')
      .first();
  }

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

    console.log(query.first.toString());
    const result = await query.first();
    await this.pg.create(
      0,
      'sc.funding_account_data',
      {
        account_number: input.accountNumber,
        name: input.name,
        neo4j_id: result?.id,
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    return result;
  }

  async readOne(id: ID, session: Session) {
    const query = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FundingAccount', { id })])
      .apply(this.hydrate());

    const result = await query.first();
    const pgResult = await this.pg.pool.query(
      'select name, account_number, neo4j_id, created_at from sc.funding_account_data where neo4j_id = $1',
      [id]
    );

    if (!result) {
      throw new NotFoundException('Could not found funding account');
    }
    console.log({
      pg: {
        name: pgResult.rows[0]?.name,
        accountNumber: pgResult.rows[0]?.account_number,
        createdAt: pgResult.rows[0]?.created_at,
        canDelete: true,
        id: pgResult.rows[0]?.neo4j_id,
      },
      neo4j: result.dto,
    });
    return result.dto;
  }

  async list(input: FundingAccountListInput, session: Session) {
    const label = 'FundingAccount';
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(sorting(FundingAccount, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
