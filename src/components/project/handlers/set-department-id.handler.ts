import { ID, ServerException, UnsecuredDto } from '../../../common';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { Project, ProjectStep } from '../dto';
import { ProjectUpdatedEvent } from '../events';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SetDepartmentId implements IEventHandler<SubscribedEvent> {
  constructor(private readonly db: DatabaseService) {}

  async handle(event: SubscribedEvent) {
    const shouldSetDepartmentId =
      event.updates.step === ProjectStep.PendingFinanceConfirmation &&
      !event.updated.departmentId;
    if (!shouldSetDepartmentId) {
      return;
    }

    try {
      const departmentId = await this.assignDepartmentIdForProject(
        event.updated
      );
      event.updated = {
        ...event.updated,
        departmentId,
      };
    } catch (exception) {
      throw new ServerException(
        'Could not set departmentId on project',
        exception
      );
    }
  }

  private async assignDepartmentIdForProject(project: UnsecuredDto<Project>) {
    const departmentIdPrefix = await this.getFundingAccountNumber(project);
    const res = await this.db
      .query()
      .raw(
        //TODO: determine if schema update should be applied to allow for transaction locks.
        `
        MATCH ()-[:departmentId]-(departmentIdPropertyNode:Property)
        WHERE departmentIdPropertyNode.value STARTS WITH $departmentIdPrefix
        WITH collect(distinct(toInteger(right(departmentIdPropertyNode.value, 4)))) as listOfDepartmentIds
        WITH [n IN range(11, 9999) WHERE NOT n IN listOfDepartmentIds] as listOfUnusedDepartmentIds
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
        { departmentIdPrefix: departmentIdPrefix, projectId: project.id }
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
        { projectId: project.id }
      )
      .asResult<{ prefix: number }>()
      .first();
    if (!res) {
      throw new ServerException(
        `Unable to find accountNumber associated with project: ${project.id}`
      );
    }
    return res.prefix.toString();
  }
}
