import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  INACTIVE,
  matchChangesetAndChangedProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  sorting,
} from '../../core/database/query';
import { BudgetRecord, BudgetRecordListInput, CreateBudgetRecord } from './dto';

@Injectable()
export class BudgetRecordRepository extends DtoRepository(BudgetRecord) {
  async create(input: CreateBudgetRecord, changeset?: ID) {
    const result = await this.db
      .query()
      .apply(
        await createNode(BudgetRecord, {
          initialProps: {
            fiscalYear: input.fiscalYear,
            amount: null,
          },
        })
      )
      .apply(
        createRelationships(BudgetRecord, {
          in: {
            record: ['Budget', input.budgetId],
            changeset: ['Changeset', changeset],
          },
          out: {
            organization: ['Organization', input.organizationId],
          },
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create a budget record');
    }
    return result.id;
  }

  async doesRecordExist(input: CreateBudgetRecord) {
    const result = await this.db
      .query()
      .match([
        node('budget', 'Budget', { id: input.budgetId }),
        relation('out', '', 'record', ACTIVE),
        node('br', 'BudgetRecord'),
        relation('out', '', 'organization', ACTIVE),
        node('', 'Organization', { id: input.organizationId }),
      ])
      .match([
        node('br'),
        relation('out', '', 'fiscalYear', ACTIVE),
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
        // omitting active checks on these two relations which could be either depending on changeset
        relation('out', '', 'budget'),
        node('', 'Budget'),
        relation('out', '', 'record'),
        node('node', 'BudgetRecord', { id }),
      ])
      .apply(this.hydrate({ session, changeset }))
      .return<{ dto: UnsecuredDto<BudgetRecord> }>('dto');
    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find BudgetRecord',
        'budgetRecord.budgetId'
      );
    }

    return result.dto;
  }

  async list(input: BudgetRecordListInput, session: Session, changeset?: ID) {
    const { budgetId } = input.filter;
    const result = await this.db
      .query()
      .matchNode('budget', 'Budget', { id: budgetId })
      .apply(this.recordsOfBudget({ changeset }))
      .apply(sorting(BudgetRecord, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  hydrate({
    recordVar = 'node',
    projectVar = 'project',
    outputVar = 'dto',
    session,
    changeset,
  }: {
    recordVar?: string;
    projectVar?: string;
    outputVar?: string;
    session: Session;
    changeset?: ID;
  }) {
    return (query: Query) =>
      query.subQuery((sub) =>
        sub
          .with([recordVar, projectVar]) // import
          // rename to constant, only apply if making a change otherwise cypher breaks
          .apply((q) =>
            recordVar !== 'node' || projectVar !== 'project'
              ? q.with({ [recordVar]: 'node', [projectVar]: 'project' })
              : q
          )
          .match([
            node('node'),
            relation('out', '', 'organization', ACTIVE),
            node('organization', 'Organization'),
          ])
          .apply(matchChangesetAndChangedProps(changeset))
          .apply(matchPropsAndProjectSensAndScopedRoles(session))
          .return<{ dto: UnsecuredDto<BudgetRecord> }>(
            merge('props', 'changedProps', {
              organization: 'organization.id',
              scope: 'scopedRoles',
              changeset: 'changeset.id',
            }).as(outputVar)
          )
      );
  }

  recordsOfBudget({
    budgetVar = 'budget',
    changeset,
    outputVar = 'node',
  }: {
    budgetVar?: string;
    changeset?: ID;
    outputVar?: string;
  }) {
    return (query: Query) =>
      query.subQuery((sub) =>
        sub
          .with(budgetVar)
          .match([
            node(budgetVar),
            relation('out', '', 'record', ACTIVE),
            node('node', 'BudgetRecord'),
          ])
          .return({ node: outputVar })
          .apply((q) =>
            changeset
              ? q
                  .union()
                  .match([
                    node(budgetVar),
                    relation('out', '', 'record', INACTIVE),
                    node('node', 'BudgetRecord'),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return({ node: outputVar })
              : q
          )
      );
  }
}
