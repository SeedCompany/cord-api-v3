import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  DatabaseService,
  DtoRepository,
  matchRequestingUser,
  matchSession,
} from '../../core';
import {
  createNode,
  createRelationships,
  matchChangesetAndChangedProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
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
    session: Session,
    universalTemplateFile: ID
  ) {
    const initialProps = {
      //universalTemplateFile: input.universalTemplateFile,
      universalTemplateFile,
      status: Status.Pending,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Budget, { initialProps }))
      .apply(
        createRelationships(Budget, {
          out: {
            project: ['Project', input.projectId],
          },
        })
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('Failed to create budget');
    }
    return result;
  }

  async readOne(id: ID, session: Session, changeset?: ID) {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('node', 'Budget', { id }),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .apply(matchChangesetAndChangedProps(changeset))
      .return<{ dto: UnsecuredDto<Budget> }>(
        merge('props', 'changedProps', {
          scope: 'scopedRoles',
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

  async getStatusByRecord(recordId: ID) {
    const result = await this.db
      .query()
      .match([
        node('budgetRecord', 'BudgetRecord', { id: recordId }),
        relation('in', '', 'record', { active: true }),
        node('budget', 'Budget'),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property'),
      ])
      .return('status.value as status')
      .asResult<{ status: Status }>()
      .first();
    if (!result) {
      throw new NotFoundException('Budget could not be found');
    }
    return result.status;
  }

  async list({ filter, ...input }: BudgetListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Budget'),
        ...(filter.projectId
          ? [
              relation('in', '', 'budget', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(sorting(Budget, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listNoSecGroups({ filter, ...input }: BudgetListInput) {
    const result = await this.db
      .query()
      .match([
        ...(filter.projectId
          ? [
              node('node', 'Budget'),
              relation('in', '', 'budget', { active: true }),
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
            relation('out', '', 'budget', { active: true }),
            node('budget', 'Budget'),
            relation('out', '', 'status', { active: true }),
            node('status', 'Property'),
          ])
          // Pending changeset
          .apply((q) =>
            changeset
              ? q.optionalMatch([
                  node('changeset', 'Changeset', { id: changeset }),
                  relation('out', '', 'status', { active: true }),
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
    const result = await this.db
      .query()
      .apply(this.currentBudgetForProject(projectId, changeset))
      .subQuery((sub) =>
        sub
          .with('project, budget')
          .apply(this.records.recordsOfBudget({ changeset }))
          .apply(this.records.hydrate({ session, changeset }))
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
