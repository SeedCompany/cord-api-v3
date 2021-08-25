import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  labelForView,
  NotFoundException,
  ObjectView,
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

  async readOne(id: ID, session: Session, view?: ObjectView) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        // omitting active checks on these two relations which could be either depending on changeset
        relation('out', '', 'budget'),
        // read deleted record in active or deleted budget
        node('', labelForView('Budget', view)),
        relation('out', '', 'record'),
        node('node', labelForView('BudgetRecord', view), { id }),
      ])
      .apply(this.hydrate({ session, view }))
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

  async list(
    input: BudgetRecordListInput,
    session: Session,
    view?: ObjectView
  ) {
    const { budgetId } = input.filter;
    const result = await this.db
      .query()
      .matchNode('budget', labelForView('Budget', view), { id: budgetId })
      .apply(this.recordsOfBudget({ view }))
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
    view,
  }: {
    recordVar?: string;
    projectVar?: string;
    outputVar?: string;
    session: Session;
    view?: ObjectView;
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
          .apply(matchChangesetAndChangedProps(view?.changeset))
          .apply(matchPropsAndProjectSensAndScopedRoles(session, { view }))
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
    view,
    outputVar = 'node',
  }: {
    budgetVar?: string;
    view?: ObjectView;
    outputVar?: string;
  }) {
    return (query: Query) =>
      query.subQuery((sub) =>
        sub
          .with(budgetVar)
          .match([
            node(budgetVar),
            relation('out', '', 'record', ACTIVE),
            node('node', labelForView('BudgetRecord', view)),
          ])
          .return({ node: outputVar })
          .apply((q) =>
            view?.changeset
              ? q
                  .union()
                  .match([
                    node(budgetVar),
                    relation('out', '', 'record', INACTIVE),
                    node('node', 'BudgetRecord'),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset', 'Changeset', { id: view.changeset }),
                  ])
                  .return({ node: outputVar })
              : q
          )
      );
  }
}
