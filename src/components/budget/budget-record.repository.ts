import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { ScopedRole } from '../authorization';
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
      .apply((q) =>
        changeset
          ? q.match([
              node('node'),
              relation('in', '', 'changeset', { active: true }),
              node('changesetNode', 'Changeset', { id: changeset }),
            ])
          : q
      )
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return([
        'apoc.map.merge(props, { organization: organization.id }) as props',
        'scopedRoles',
      ])
      .asResult<{
        props: DbPropsOfDto<BudgetRecord, true>;
        scopedRoles: ScopedRole[];
      }>();
    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find BudgetRecord',
        'budgetRecord.budgetId'
      );
    }

    return result;
  }

  list(input: BudgetRecordListInput, session: Session, changeset?: ID) {
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('BudgetRecord'),
        ...(input.filter.budgetId
          ? [
              relation('in', '', 'record', {
                active: !changeset,
              }),
              node('budget', 'Budget', {
                id: input.filter.budgetId,
              }),
            ]
          : []),
      ])
      .apply((q) =>
        changeset
          ? q.match([
              node('node'),
              relation('in', '', 'changeset', { active: true }),
              node('changesetNode', 'Changeset', { id: changeset }),
            ])
          : q
      )
      .apply(calculateTotalAndPaginateList(BudgetRecord, input));
  }
}
