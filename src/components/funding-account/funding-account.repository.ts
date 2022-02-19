import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  createNode,
  paginate,
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
