import { Injectable } from '@nestjs/common';
import { node, Query } from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  createNode,
  matchProps,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '~/core/database/query';
import * as departmentIdBlockUtils from '../finance/department/neo4j.utils';
import { ProjectType as Program } from '../project/dto/project-type.enum';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  UpdateFundingAccount,
} from './dto';

const blockOfAccount = (accountNumber: number) =>
  [
    {
      start: accountNumber * 10000 + 11,
      end: (accountNumber + 1) * 10000 - 1,
    },
  ] as const;

@Injectable()
export class FundingAccountRepository extends DtoRepository(FundingAccount) {
  async create(input: CreateFundingAccount) {
    const initialProps = {
      name: input.name,
      accountNumber: input.accountNumber,
      canDelete: true,
    };
    const query = this.db
      .query()
      .apply(await createNode(FundingAccount, { initialProps }))
      .apply(
        departmentIdBlockUtils.create({
          blocks: blockOfAccount(input.accountNumber),
          programs: [Program.MomentumTranslation, Program.Internship],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async update(changes: UpdateFundingAccount) {
    const { id, ...simpleChanges } = changes;
    const { accountNumber } = changes;
    await this.updateProperties({ id }, simpleChanges);
    if (accountNumber) {
      await this.db
        .query()
        .match(node('node', 'FundingAccount', { id }))
        .apply(
          departmentIdBlockUtils.upsert({
            blocks: blockOfAccount(accountNumber),
          }),
        )
        .return('*')
        .run();
    }
    return await this.readOne(id);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .apply(departmentIdBlockUtils.hydrate())
        .return<{ dto: UnsecuredDto<FundingAccount> }>(
          merge('props', {
            departmentIdBlock: 'departmentIdBlock',
          }).as('dto'),
        );
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
