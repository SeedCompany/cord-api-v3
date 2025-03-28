import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  apoc,
  createNode,
  matchProps,
  merge,
  paginate,
  requestingUser,
  sorting,
  variable,
} from '~/core/database/query';
import { ProjectType as Program } from '../project/dto/project-type.enum';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  UpdateFundingAccount,
} from './dto';

const blockOfAccount = (accountNumber: number) => [
  {
    start: accountNumber * 10000 + 11,
    end: (accountNumber + 1) * 10000 - 1,
  },
];

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
      .create([
        node('node'),
        relation('out', '', 'departmentIdBlock', ACTIVE),
        node('', 'DepartmentIdBlock', {
          id: variable(apoc.create.uuid()),
          blocks: variable(
            apoc.convert.toJson(blockOfAccount(input.accountNumber)),
          ),
          programs: [Program.MomentumTranslation, Program.Internship],
        }),
      ])
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
        .match([
          node('node', 'FundingAccount', { id }),
          relation('out', '', 'departmentIdBlock'),
          node('block', 'DepartmentIdBlock'),
        ])
        .setVariables({
          'block.blocks': apoc.convert.toJson(blockOfAccount(accountNumber)),
        })
        .run();
    }
    return await this.readOne(id);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('node'),
          relation('out', '', 'departmentIdBlock'),
          node('departmentIdBlock', 'DepartmentIdBlock'),
        ])
        .return<{ dto: UnsecuredDto<FundingAccount> }>(
          merge('props', {
            departmentIdBlock: merge('departmentIdBlock', {
              blocks: apoc.convert.fromJsonList('departmentIdBlock.blocks'),
            }),
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
