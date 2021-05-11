import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';

import { Session, ID, generateId } from '../../common';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';

import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbChanges } from '../../core/database/changes';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  UpdateFundingAccount,
} from './dto';
import { session } from 'neo4j-driver';

@Injectable()
export class FundingAccountRepository {
  constructor(private readonly db: DatabaseService) {}

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
      .return('node.id as id');

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

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(
    fundingAccount: FundingAccount,
    input: UpdateFundingAccount
  ) {
    return this.db.getActualChanges(FundingAccount, fundingAccount, input);
  }

  async updateProperties(
    object: FundingAccount,
    changes: DbChanges<FundingAccount>
  ) {
    return await this.db.updateProperties({
      type: FundingAccount,
      object,
      changes,
    });
  }

  async deleteNode(node: FundingAccount) {
    return await this.db.deleteNode(node);
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
