import { Injectable } from '@nestjs/common';
import { inArray, node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
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

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FundingAccount', { id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not found funding account');
    }
    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('node', 'FundingAccount')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate())
      .map('dto')
      .run();
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
