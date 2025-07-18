import { Injectable } from '@nestjs/common';
import { inArray, node, type Query, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import {
  CreationFailed,
  type ID,
  labelForView,
  NotFoundException,
  type ObjectView,
  type UnsecuredDto,
  viewOfChangeset,
} from '~/common';
import { DtoRepository } from '~/core/database';
import { type ChangesOf } from '~/core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchChangesetAndChangedProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  sorting,
} from '~/core/database/query';
import { type FileId } from '../file/dto';
import { BudgetRecordRepository } from './budget-record.repository';
import {
  Budget,
  type BudgetListInput,
  type BudgetRecord,
  type CreateBudget,
  BudgetStatus as Status,
  type UpdateBudget,
} from './dto';

@Injectable()
export class BudgetRepository extends DtoRepository<
  typeof Budget,
  [view?: ObjectView]
>(Budget) {
  constructor(private readonly records: BudgetRecordRepository) {
    super();
  }

  async create(input: CreateBudget, universalTemplateFileId: FileId) {
    const initialProps = {
      status: Status.Pending,
      universalTemplateFile: universalTemplateFileId,
      canDelete: true,
    };

    const result = await this.db
      .query()
      .apply(await createNode(Budget, { initialProps }))
      .apply(
        createRelationships(Budget, 'in', {
          budget: ['Project', input.projectId],
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new CreationFailed(Budget);
    }

    return result.id;
  }

  async update(
    existing: Budget,
    simpleChanges: Omit<
      ChangesOf<Budget, UpdateBudget>,
      'universalTemplateFile'
    >,
  ) {
    return await this.updateProperties(existing, simpleChanges);
  }

  async readMany(ids: readonly ID[], view?: ObjectView) {
    const label = labelForView('Budget', view);
    return await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', ACTIVE),
        node('node', label),
      ])
      .where({ 'node.id': inArray(ids) })
      .apply(matchPropsAndProjectSensAndScopedRoles({ view }))
      .apply(matchChangesetAndChangedProps(view?.changeset))
      .return<{ dto: UnsecuredDto<Budget> }>(
        merge('props', 'changedProps', {
          parent: 'project',
          changeset: 'changeset.id',
        }).as('dto'),
      )
      .map((row) => row.dto)
      .run();
  }

  async list({ filter, ...input }: BudgetListInput) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Budget'),
        relation('in', '', 'budget', ACTIVE),
        node('project', 'Project', pickBy({ id: filter?.projectId })),
      ])
      .apply(
        this.privileges.filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sorting(Budget, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listUnsecure({ filter, ...input }: BudgetListInput) {
    const result = await this.db
      .query()
      .match([
        ...(filter?.projectId
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
              : q.subQuery((sub2) => sub2.return('null as changesetStatus')),
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
          .return('project, budget, status'),
      );
  }

  async listRecordsForSync(projectId: ID, changeset?: ID) {
    const view: ObjectView = viewOfChangeset(changeset);
    const result = await this.db
      .query()
      .apply(this.currentBudgetForProject(projectId, changeset))
      .subQuery((sub) =>
        sub
          .with('project, budget')
          .apply(this.records.recordsOfBudget({ view }))
          .apply(this.records.hydrate({ view }))
          .return('collect(dto) as records'),
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
