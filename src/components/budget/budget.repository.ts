import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  labelForView,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
  viewOfChangeset,
} from '../../common';
import {
  DatabaseService,
  DtoRepository,
  matchRequestingUser,
  matchSession,
} from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchChangesetAndChangedProps,
  matchProjectSensToLimitedScopeMap,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { BudgetRecordRepository } from './budget-record.repository';
import {
  Budget,
  BudgetListInput,
  BudgetRecord,
  CreateBudget,
  BudgetStatus as Status,
} from './dto';

@Injectable()
export class BudgetRepository extends DtoRepository(Budget) {
  constructor(
    db: DatabaseService,
    private readonly records: BudgetRecordRepository
  ) {
    super(db);
  }

  async doesProjectExist(projectId: ID, session: Session) {
    const result = await this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('project', 'Project', { id: projectId })])
      .return('project.id')
      .first();
    return !!result;
  }

  async create(
    input: CreateBudget,
    universalTemplateFileId: ID,
    session: Session
  ) {
    const initialProps = {
      status: Status.Pending,
      universalTemplateFile: universalTemplateFileId,
      canDelete: true,
    };

    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Budget, { initialProps }))
      .apply(
        createRelationships(Budget, 'in', {
          budget: ['Project', input.projectId],
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new ServerException('Failed to create budget');
    }

    return result.id;
  }

  async readOne(id: ID, session: Session, view?: ObjectView) {
    const label = labelForView('Budget', view);
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', ACTIVE),
        node('node', label, { id }),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session, { view }))
      .apply(matchChangesetAndChangedProps(view?.changeset))
      .return<{ dto: UnsecuredDto<Budget> }>(
        merge('props', 'changedProps', {
          changeset: 'changeset.id',
        }).as('dto')
      )
      .map((row) => row.dto)
      .first();
    if (!result) {
      throw new NotFoundException('Could not find budget', 'budget.id');
    }

    return result;
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const label = labelForView('Budget', view);
    return await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', ACTIVE),
        node('node', label),
      ])
      .where({ 'node.id': inArray(ids) })
      .apply(matchPropsAndProjectSensAndScopedRoles(session, { view }))
      .apply(matchChangesetAndChangedProps(view?.changeset))
      .return<{ dto: UnsecuredDto<Budget> }>(
        merge('props', 'changedProps', {
          changeset: 'changeset.id',
        }).as('dto')
      )
      .map((row) => row.dto)
      .run();
  }

  async getStatusByRecord(recordId: ID) {
    const result = await this.db
      .query()
      .match([
        node('budgetRecord', 'BudgetRecord', { id: recordId }),
        relation('in', '', 'record', ACTIVE),
        node('budget', 'Budget'),
        relation('out', '', 'status', ACTIVE),
        node('status', 'Property'),
      ])
      .return<{ status: Status }>('status.value as status')
      .first();
    if (!result) {
      throw new NotFoundException('Budget could not be found');
    }
    return result.status;
  }

  async list(
    { filter, ...input }: BudgetListInput,
    session: Session,
    limitedScope?: AuthSensitivityMapping
  ) {
    const matchProjectId = filter.projectId ? { id: filter.projectId } : {};

    const result = await this.db
      .query()
      .match([
        ...(limitedScope
          ? [
              node('project', 'Project', matchProjectId),
              relation('out', '', 'budget', ACTIVE),
            ]
          : filter.projectId
          ? [
              relation('in', '', 'budget', ACTIVE),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
        node('node', 'Budget'),
      ])
      .match(requestingUser(session))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
      .apply(sorting(Budget, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listUnsecure({ filter, ...input }: BudgetListInput) {
    const result = await this.db
      .query()
      .match([
        ...(filter.projectId
          ? [
              node('node', 'Budget'),
              relation('in', '', 'budget', ACTIVE),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : [node('node', 'Budget')]),
      ])
      .apply(sorting(Budget, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  currentBudgetForProject(projectId: ID, changeset?: ID) {
    return (query: Query) =>
      query.subQuery((sub) =>
        sub
          .match([
            node('project', 'Project', { id: projectId }),
            relation('out', '', 'budget', ACTIVE),
            node('budget', 'Budget'),
            relation('out', '', 'status', ACTIVE),
            node('status', 'Property'),
          ])
          // Pending changeset
          .apply((q) =>
            changeset
              ? q.optionalMatch([
                  node('changeset', 'Changeset', { id: changeset }),
                  relation('out', '', 'status', ACTIVE),
                  node('changesetStatus', 'Property', { value: 'Pending' }),
                ])
              : q.subQuery((sub2) => sub2.return('null as changesetStatus'))
          )
          .with([
            'project, budget',
            // Budget's are pending in a pending changeset
            'coalesce(changesetStatus.value, status.value) as status',
            // rank them current, then pending, then w/e.
            // Pick the first one.
            `
              case coalesce(changesetStatus.value, status.value)
                when "${Status.Current}" then 0
                when "${Status.Pending}" then 1
                else 100
              end as statusRank
            `,
          ])
          .orderBy('statusRank')
          .limit(1)
          .return('project, budget, status')
      );
  }

  async listRecordsForSync(projectId: ID, session: Session, changeset?: ID) {
    const view: ObjectView = viewOfChangeset(changeset);
    const result = await this.db
      .query()
      .apply(this.currentBudgetForProject(projectId, changeset))
      .subQuery((sub) =>
        sub
          .with('project, budget')
          .apply(this.records.recordsOfBudget({ view }))
          .apply(this.records.hydrate({ session, view }))
          .return('collect(dto) as records')
      )
      .return<
        UnsecuredDto<Pick<Budget, 'id' | 'status'>> & {
          records: ReadonlyArray<UnsecuredDto<BudgetRecord>>;
        }
      >(['budget.id as id', 'status', 'records'])
      .first();
    if (!result) {
      throw new NotFoundException("Could not find project's budget");
    }
    return result;
  }
}
