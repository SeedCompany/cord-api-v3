import { Injectable } from '@nestjs/common';
import { stripIndent } from 'common-tags';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchChangesetAndChangedProps,
  matchPropsAndProjectSensAndScopedRoles,
} from '../../core/database/query';
import { BudgetRecord, BudgetRecordListInput, CreateBudgetRecord } from './dto';

@Injectable()
export class BudgetRecordRepository extends DtoRepository(BudgetRecord) {
  async create(session: Session, secureProps: Property[]) {
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'BudgetRecord', secureProps))
      .return('node.id as id')
      .asResult<{ id: ID }>()
      .first();
    if (!result) {
      throw new ServerException('Failed to create a budget record');
    }
    return result.id;
  }

  async connectToBudget(
    recordId: ID,
    budgetId: ID,
    createdAt: DateTime,
    changeset?: ID
  ) {
    await this.db
      .query()
      .match([node('budget', 'Budget', { id: budgetId })])
      .match([node('br', 'BudgetRecord', { id: recordId })])
      .apply((q) =>
        changeset
          ? q.match([node('changesetNode', 'Changeset', { id: changeset })])
          : q
      )
      .create([
        node('budget'),
        relation('out', '', 'record', { active: !changeset, createdAt }),
        node('br'),
        ...(changeset
          ? [
              relation('in', '', 'changeset', { active: true }),
              node('changesetNode'),
            ]
          : []),
      ])
      .return('br')
      .run();
  }

  async connectToOrganization(
    recordId: ID,
    organizationId: ID,
    createdAt: DateTime
  ) {
    await this.db
      .query()
      .match([
        node('organization', 'Organization', {
          id: organizationId,
        }),
      ])
      .match([node('br', 'BudgetRecord', { id: recordId })])
      .create([
        node('br'),
        relation('out', '', 'organization', { active: true, createdAt }),
        node('organization'),
      ])
      .return('br')
      .run();
  }

  async doesRecordExist(input: CreateBudgetRecord) {
    const result = await this.db
      .query()
      .match([
        node('budget', 'Budget', { id: input.budgetId }),
        relation('out', '', 'record', { active: true }),
        node('br', 'BudgetRecord'),
        relation('out', '', 'organization', { active: true }),
        node('', 'Organization', { id: input.organizationId }),
      ])
      .match([
        node('br'),
        relation('out', '', 'fiscalYear', { active: true }),
        node('', 'Property', { value: input.fiscalYear }),
      ])
      .return('br')
      .first();
    return !!result;
  }

  async readOne(id: ID, session: Session, changeset?: ID) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('', 'Budget'),
        relation('out', '', 'record', { active: !changeset }),
        node('node', 'BudgetRecord', { id }),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .apply(matchChangesetAndChangedProps(changeset))
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return<{ dto: UnsecuredDto<BudgetRecord> }>(
        stripIndent`
          apoc.map.mergeList([
            props,
            changedProps,
            {
              organization: organization.id,
              scope: scopedRoles,
              changeset: coalesce(changeset.id)
            }
          ]) as dto
        `
      );
    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find BudgetRecord',
        'budgetRecord.budgetId'
      );
    }

    return result.dto;
  }

  list(input: BudgetRecordListInput, session: Session, changeset?: ID) {
    const { budgetId } = input.filter;
    return this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            node('node', 'BudgetRecord'),
            ...(budgetId
              ? [
                  relation('in', '', 'record', { active: true }),
                  node('budget', 'Budget', { id: budgetId }),
                ]
              : []),
          ])
          .return('node')
          .apply((q) =>
            changeset
              ? q
                  .union()
                  .match([
                    ...(budgetId
                      ? [
                          node('budget', 'Budget', { id: budgetId }),
                          relation('out', '', 'record', { active: false }),
                        ]
                      : []),
                    node('node', 'BudgetRecord'),
                    relation('in', '', 'changeset', { active: true }),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return('node')
              : q
          )
      )
      .apply(calculateTotalAndPaginateList(BudgetRecord, input));
  }
}
