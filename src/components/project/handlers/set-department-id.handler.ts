import { isNull, node, not, relation } from 'cypher-query-builder';
import { ClientException, ID, ServerException, UnsecuredDto } from '~/common';
import { ConfigService, EventsHandler, IEventHandler } from '~/core';
import { DatabaseService } from '~/core/database';
import {
  ACTIVE,
  apoc,
  collect,
  updateProperty,
  variable,
} from '~/core/database/query';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  resolveProjectType,
  stepToStatus,
} from '../dto';
import { ProjectTransitionedEvent } from '../workflow/events/project-transitioned.event';

type SubscribedEvent = ProjectTransitionedEvent;

@EventsHandler(ProjectTransitionedEvent)
export class SetDepartmentId implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async handle(event: SubscribedEvent) {
    if (this.config.databaseEngine === 'gel') {
      return;
    }

    const step = event.workflowEvent.to;
    const status = stepToStatus(step);

    const shouldSetDepartmentId =
      !event.project.departmentId &&
      ProjectStatus.entries.findIndex((s) => s.value === status) <=
        ProjectStatus.entries.findIndex(
          (s) => s.value === ProjectStatus.Active,
        ) &&
      ProjectStep.entries.findIndex((s) => s.value === step) >=
        ProjectStep.entries.findIndex(
          (s) => s.value === ProjectStep.PendingFinanceConfirmation,
        );
    if (!shouldSetDepartmentId) {
      return;
    }

    const block = await this.getDepartmentIdBlockId(event.project);

    const departmentId = await this.assignDepartmentIdForProject(
      event.project,
      block,
    );
    event.project = {
      ...event.project,
      departmentId,
    };
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
          .match([
            node('', 'Project'),
            relation('out', '', 'departmentId', ACTIVE),
            node('deptIdNode', 'Property'),
          ])
          .where({ 'deptIdNode.value': not(isNull()) })
          .return(collect('deptIdNode.value').as('used')),
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
              node('project'),
              relation('out', '', 'partnership', ACTIVE),
              node('holder', 'Partnership'),
              relation('out', '', 'primary', ACTIVE),
              node('', 'Property', { value: variable('true') }),
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
