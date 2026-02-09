import { Injectable } from '@nestjs/common';
import { isNull, node, not, relation } from 'cypher-query-builder';
import {
  ClientException,
  type ID,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ConfigService } from '~/core';
import {
  DatabaseService,
  TransactionRetryInformer,
  UniquenessError,
} from '~/core/database';
import {
  ACTIVE,
  apoc,
  collect,
  updateProperty,
  variable,
} from '~/core/database/query';
import { OnHook } from '~/core/hooks';
import {
  type Project,
  resolveProjectType,
  ProjectStatus as Status,
  ProjectStep as Step,
} from '../dto';
import { ProjectUpdatedHook } from '../hooks';
import { ProjectTransitionedHook } from '../workflow/hooks/project-transitioned.hook';

@Injectable()
export class SetDepartmentId {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly retryInformer: TransactionRetryInformer,
  ) {}

  @OnHook(ProjectTransitionedHook)
  @OnHook(ProjectUpdatedHook)
  async handle(event: ProjectTransitionedHook | ProjectUpdatedHook) {
    if (this.config.databaseEngine === 'gel') {
      return;
    }

    const project =
      event instanceof ProjectTransitionedHook ? event.project : event.updated;

    const { status, step } = project;

    const shouldSetDepartmentId =
      !project.departmentId &&
      Status.indexOf(status) <= Status.indexOf('Active') &&
      Step.indexOf(step) >= Step.indexOf('PendingFinanceConfirmation');
    if (!shouldSetDepartmentId) {
      return;
    }

    const block = await this.getDepartmentIdBlockId(project);

    const departmentId = await this.assignDepartmentIdForProject(
      project,
      block,
    );
    const changed = { ...project, departmentId };

    if (event instanceof ProjectTransitionedHook) {
      event.project = changed;
    } else {
      event.updated = changed;
    }
  }

  private async assignDepartmentIdForProject(
    project: UnsecuredDto<Project>,
    block: { id: ID },
  ) {
    const query = this.db
      .query()
      // Enumerate IDs from the department ID block
      .subQuery((sub) =>
        sub
          .match(node('block', 'DepartmentIdBlock', { id: block.id }))
          .with(apoc.convert.fromJsonList('block.blocks').as('blocks'))
          // enumerate all ranges
          .with(
            apoc.coll
              .flatten(['block in blocks | range(block.start, block.end)'])
              .as('ids'),
          )
          // convert numbers to strings and pad to 5 digits with leading zeros
          .with(
            `[id in ids |
              case
                when id < 10000 then
                  apoc.text.lpad(toString(id), 5, "0")
                else toString(id)
              end
            ] as ids`,
          )
          .return('ids as enumerated'),
      )
      // Get used IDs
      .subQuery((sub) =>
        sub
          .subQuery((sub2) =>
            sub2
              .match([
                node('', 'Project'),
                relation('out', '', 'departmentId', ACTIVE),
                node('deptIdNode', 'Property'),
              ])
              .where({ 'deptIdNode.value': not(isNull()) })
              .return('deptIdNode.value as id')
              .union()
              .match(node('external', 'ExternalDepartmentId'))
              .return('external.departmentId as id'),
          )
          .return(collect('id').as('used')),
      )
      // Distill to available
      .with('[id in enumerated where not id in used][0] as next')
      // collapse cardinality to zero if none available
      .raw('unwind next as nextId')

      .match(node('node', 'Project', { id: project.id }))
      .apply(
        updateProperty({
          resource: resolveProjectType(project),
          key: 'departmentId',
          value: variable('nextId'),
        }),
      )
      .return<{ departmentId: string }>('nextId as departmentId, stats');
    let res;
    try {
      res = await query.first();
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'DepartmentId') {
        this.retryInformer.markForRetry(e);
      }
      throw new ServerException("Could not set Project's Department ID", e);
    }
    if (!res) {
      throw new ServerException('No department ID is available');
    }
    return res.departmentId;
  }

  private async getDepartmentIdBlockId(project: UnsecuredDto<Project>) {
    const isMultiplication = project.type === 'MultiplicationTranslation';
    if (isMultiplication) {
      if (!project.primaryPartnership) {
        throw new ClientException(
          'Project must have a partnership to continue',
        );
      }
    } else if (!project.primaryLocation) {
      throw new ClientException(
        'Project must have a primary location to continue',
      );
    }

    const block = await this.db
      .query()
      .match(node('project', 'Project', { id: project.id }))
      .match(
        isMultiplication
          ? [
              [
                node('project'),
                relation('out', '', 'partnership', ACTIVE),
                node('partnership', 'Partnership'),
                relation('out', '', 'primary', ACTIVE),
                node('', 'Property', { value: variable('true') }),
              ],
              [node('partnership'), relation('out'), node('holder', 'Partner')],
            ]
          : [
              node('project'),
              relation('out', '', 'primaryLocation', ACTIVE),
              node('', 'Location'),
              relation('out', '', 'fundingAccount', ACTIVE),
              node('holder', 'FundingAccount'),
            ],
      )
      .match([
        node('holder'),
        relation('out'),
        node('block', 'DepartmentIdBlock'),
      ])
      .return<{ id: ID }>('block.id as id')
      .first();
    if (block) {
      return block;
    }
    if (isMultiplication) {
      throw new ClientException(
        "Project's primary partner does not have a department ID blocks declared",
      );
    }
    throw new ServerException(
      `Unable to find accountNumber associated with project: ${project.id}`,
    );
  }
}
