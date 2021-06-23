import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
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
    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'FundingAccountName',
      },
      {
        key: 'accountNumber',
        value: input.accountNumber,
        isPublic: false,
        isOrgPublic: false,
        label: 'FundingAccountNumber',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'FundingAccount', secureProps))
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const readFundingAccount = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FundingAccount', { id })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<FundingAccount>>>();

    return await readFundingAccount.first();
  }

  list(input: FundingAccountListInput, session: Session) {
    const label = 'FundingAccount';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(FundingAccount, input));
    return query;
  }
}
