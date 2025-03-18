import { ClientException, ID, ServerException, UnsecuredDto } from '~/common';
import { ConfigService, EventsHandler, IEventHandler } from '~/core';
import { DatabaseService } from '~/core/database';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
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

    if (!event.project.primaryLocation) {
      throw new ClientException('Primary Location on project must be set');
    }

    try {
      const departmentId = await this.assignDepartmentIdForProject(
        event.project,
      );
      event.project = {
        ...event.project,
        departmentId,
      };
    } catch (exception) {
      throw new ServerException(
        'Could not set departmentId on project',
        exception,
      );
    }
  }

  private async assignDepartmentIdForProject(project: UnsecuredDto<Project>) {
    const info =
      project.type === ProjectType.MultiplicationTranslation
        ? {
            departmentIdPrefix: '8',
            startingOffset: 201,
          }
        : {
            departmentIdPrefix: await this.getFundingAccountNumber(project),
            startingOffset: 11,
          };

    const res = await this.db
      .query()
      .raw(
        //TODO: determine if schema update should be applied to allow for transaction locks.
        `
        MATCH ()-[:departmentId]-(departmentIdPropertyNode:Property)
        WHERE departmentIdPropertyNode.value STARTS WITH $departmentIdPrefix
        WITH collect(distinct(toInteger(right(departmentIdPropertyNode.value, 4)))) as listOfDepartmentIds
        WITH [n IN range($startingOffset, 9999) WHERE NOT n IN listOfDepartmentIds] as listOfUnusedDepartmentIds
        WITH apoc.coll.shuffle(listOfUnusedDepartmentIds) AS randomizedIds
        WITH toString(randomizedIds[0]) AS nextIdBase
        WITH $departmentIdPrefix + substring("0000", 1, 4 - size(nextIdBase)) + nextIdBase as nextId
        MATCH (project:Project {id: $projectId})
        OPTIONAL MATCH (project)-[oldDepartmentIdRelationship:departmentId {active: true}]-(oldDepartmentIdPropertyNode:Property)
        SET oldDepartmentIdRelationship.active = false
        WITH coalesce(oldDepartmentIdPropertyNode.value, nextId) as departmentId, project
        CREATE (project)-[newDepartmentIdRelationship:departmentId { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: departmentId })
        RETURN departmentId
        `,
        { ...info, projectId: project.id },
      )
      .asResult<{ departmentId: ID }>()
      .first();
    if (!res) {
      throw new ServerException('Unable to assign department ID');
    }
    return res.departmentId;
  }

  private async getFundingAccountNumber(project: UnsecuredDto<Project>) {
    const res = await this.db
      .query()
      .raw(
        `
        MATCH (:Project {id: $projectId})-[:primaryLocation {active: true}]
              -()-[:fundingAccount {active: true}]
              -()-[:accountNumber {active: true}]-(node:Property)
        RETURN node.value as prefix
      `,
        { projectId: project.id },
      )
      .asResult<{ prefix: number }>()
      .first();
    if (!res) {
      throw new ServerException(
        `Unable to find accountNumber associated with project: ${project.id}`,
      );
    }
    return res.prefix.toString();
  }
}
