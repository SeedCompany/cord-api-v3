import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { Project, ProjectStep } from '../dto';
import { ProjectUpdatedEvent } from '../events';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SetInitialEndDate implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    @Logger('project:set-department-id') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, set department id', {
      ...event,
      event: event.constructor.name,
    });

    const shouldSetDepartmentId =
      event.updates.step === ProjectStep.PendingFinanceConfirmation &&
      !event.updated.departmentId.value;
    if (!shouldSetDepartmentId) {
      return;
    }

    try {
      await this.assignDepartmentIdForProject(event.updated);
    } catch (exception) {
      throw new ServerException(
        'Could not set departmentId on project',
        exception
      );
    }
  }

  private async getDepartmentIdPrefixForProject(project: Project) {
    // TODO: validate if active property lives on relationship or BaseNode
    const accountNumbers = await this.db
      .query()
      .raw(
        `
        MATCH (:Project {id: $projectId})-[:primaryLocation]-({active: true})-[:fundingAccount]-({active: true})-[:accountNumber]-(accountNumberNode:Property {active:true})
        RETURN accountNumberNode.value
        `,
        { projectId: project.id }
      )
      .run();
    return accountNumbers[0]['accountNumberNode.value'];
  }

  private async assignDepartmentIdForProject(project: Project) {
    const departmentIdPrefix = await this.getDepartmentIdPrefixForProject(
      project
    );
    await this.db
      .query()
      .raw(
        //TODO: determine if schema update should be applied to allow for transaction locks.
        `
        MATCH ()-[:departmentId]-(departmentIdPropertyNode:Property)
        WHERE departmentIdPropertyNode.value STARTS WITH $departmentIdPrefix
        WITH collect(distinct(toInteger(right(departmentIdPropertyNode.value, 4)))) as listOfDepartmentIds
        UNWIND [n IN range(1, 9999) WHERE NOT n IN listOfDepartmentIds] as listOfUnusedDepartmentIds
        WITH toString(min(listOfUnusedDepartmentIds)) AS nextIdBase
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
      .run();

    // TODO: refactor to use return from mutating cypher query
  }
}
