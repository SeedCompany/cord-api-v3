import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { Sensitivity } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ISession } from '../auth';
import {
  EngagementListInput,
  SecuredInternshipEngagementList,
  SecuredLanguageEngagementList,
} from '../engagement/dto';
import {
  AnyProject,
  CreateProject,
  InternshipProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  ProjectStep,
  stepToStatus,
  TranslationProject,
  UpdateProject,
} from './dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('project:service') private readonly logger: ILogger
  ) {}

  async readOne(id: string, session: ISession): Promise<Project> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (token:Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (project:Project {active: true, id: $id})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadType:ACL {canReadType: true})-[:toNode]->(project)-[:type {active: true}]->(type:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditType:ACL {canEditType: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadSensitivity:ACL {canReadSensitivity: true})-[:toNode]->(project)-[:sensitivity {active: true}]->(sensitivity:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditSensitivity:ACL {canEditSensitivity: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadName:ACL {canReadName: true})-[:toNode]->(project)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditName:ACL {canEditName: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadDeptId:ACL {canReadDeptId: true})-[:toNode]->(project)-[:deptId {active: true}]->(deptId:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditDeptId:ACL {canEditDeptId: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStep:ACL {canReadStep: true})-[:toNode]->(project)-[:step {active: true}]->(step:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditStep:ACL {canEditStep: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStatus:ACL {canReadStatus: true})-[:toNode]->(project)-[:status {active: true}]->(status:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditStatus:ACL {canEditStatus: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLocation:ACL {canReadLocation: true})-[:toNode]->(project)-[:location {active: true}]->(location:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditLocation:ACL {canEditLocation: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMouStart:ACL {canReadMouStart: true})-[:toNode]->(project)-[:mouStart {active: true}]->(mouStart:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMouStart:ACL {canEditMouStart: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMouEnd:ACL {canReadMouEnd: true})-[:toNode]->(project)-[:mouEnd {active: true}]->(mouEnd:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMouEnd:ACL {canEditMouEnd: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadEstimatedSubmission:ACL {canReadEstimatedSubmission: true})-[:toNode]->(project)-[:estimatedSubmission {active: true}]->(estimatedSubmission:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditEstimatedSubmission:ACL {canEditEstimatedSubmission: true})-[:toNode]->(project)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadModifiedAt:ACL {canReadModifiedAt: true})-[:toNode]->(project)-[:modifiedAt {active: true}]->(modifiedAt:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditModifiedAt:ACL {canEditModifiedAt: true})-[:toNode]->(project)

        RETURN
          project.id as id,
          project.createdAt as createdAt,
          type.value as type,
          sensitivity.value as sensitivity,
          name.value as name,
          deptId.value as deptId,
          step.value as step,
          status.value as status,
          location.value as location,
          mouStart.value as mouStart,
          mouEnd.value as mouEnd,
          estimatedSubmission.value as estimatedSubmission,
          modifiedAt.value as modifiedAt,
          canReadType.canReadType as canReadType,
          canEditType.canEditType as canEditType,
          canReadSensitivity.canReadSensitivity as canReadSensitivity,
          canEditSensitivity.canEditSensitivity as canEditSensitivity,
          canReadName.canReadName as canReadName,
          canEditName.canEditName as canEditName,
          canReadDeptId.canReadDeptId as canReadDeptId,
          canEditDeptId.canEditDeptId as canEditDeptId,
          canReadStep.canReadStep as canReadStep,
          canEditStep.canEditStep as canEditStep,
          canReadStatus.canReadStatus as canReadStatus,
          canEditStatus.canEditStatus as canEditStatus,
          canReadLocation.canReadLocation as canReadLocation,
          canEditLocation.canEditLocation as canEditLocation,
          canReadMouStart.canReadMouStart as canReadMouStart,
          canEditMouStart.canEditMouStart as canEditMouStart,
          canReadMouEnd.canReadMouEnd as canReadMouEnd,
          canEditMouEnd.canEditMouEnd as canEditMouEnd,
          canReadEstimatedSubmission.canReadEstimatedSubmission as canReadEstimatedSubmission,
          canEditEstimatedSubmission.canEditEstimatedSubmission as canEditEstimatedSubmission,
          canReadModifiedAt.canReadModifiedAt as canReadModifiedAt,
          canEditModifiedAt.canEditModifiedAt as canEditModifiedAt
      `,
        {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
        }
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find project');
    }

    return {
      id,
      createdAt: result.createdAt,
      modifiedAt: result.modifiedAt,
      type: result.type,
      sensitivity: result.sensitivity,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      deptId: {
        value: result.deptId,
        canRead: !!result.canReadDeptId,
        canEdit: !!result.canEditDeptId,
      },
      step: {
        value: result.step,
        canRead: !!result.canReadStep,
        canEdit: !!result.canEditStep,
      },
      status: result.status,
      location: {
        value: undefined, // TODO: location not implemented yet
        canRead: !!result.canReadLocation,
        canEdit: !!result.canEditLocation,
      },
      mouStart: {
        value: result.mouStart,
        canRead: !!result.canReadMouStart,
        canEdit: !!result.canEditMouStart,
      },
      mouEnd: {
        value: result.mouEnd,
        canRead: !!result.canReadMouEnd,
        canEdit: !!result.canEditMouEnd,
      },
      estimatedSubmission: {
        value: result.estimatedSubmission,
        canRead: !!result.canReadEstimatedSubmission,
        canEdit: !!result.canEditEstimatedSubmission,
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: ProjectListInput,
    session: ISession
  ): Promise<ProjectListOutput> {
    const result = await this.db.list<Project>({
      session,
      nodevar: 'project',
      aclReadProp: 'canReadProjects',
      aclEditProp: 'canCreateProject',
      props: [
        { name: 'type', secure: false },
        { name: 'sensitivity', secure: false },
        { name: 'name', secure: true },
        { name: 'deptId', secure: true },
        { name: 'step', secure: true },
        { name: 'status', secure: false },
        { name: 'location', secure: true },
        { name: 'mouStart', secure: true },
        { name: 'mouEnd', secure: true },
        { name: 'estimatedSubmission', secure: true },
        { name: 'modifiedAt', secure: false },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items.map(item => ({
        ...item,
        location: {
          value: undefined,
          canEdit: true,
          canRead: true,
        },
      })),
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async listEngagements(
    project: TranslationProject,
    input: EngagementListInput,
    session: ISession
  ): Promise<SecuredLanguageEngagementList>;
  async listEngagements(
    project: InternshipProject,
    input: EngagementListInput,
    session: ISession
  ): Promise<SecuredInternshipEngagementList>;
  async listEngagements(
    _project: AnyProject,
    _input: EngagementListInput,
    _session: ISession
  ): Promise<SecuredLanguageEngagementList | SecuredInternshipEngagementList> {
    // Maybe call EngagementService?
    throw new NotImplementedException();
  }

  async create(
    { locationId, ...input }: CreateProject,
    session: ISession
  ): Promise<Project> {
    const id = generate();
    const acls = {
      canReadModifiedAt: true,
      canEditModifiedAt: true,
      canReadType: true,
      canEditType: true,
      canReadSensitivity: true,
      canEditSensitivity: true,
      canReadName: true,
      canEditName: true,
      canReadDeptId: true,
      canEditDeptId: true,
      canReadStatus: true,
      canEditStatus: true,
      canReadLocation: true,
      canEditLocation: true,
      canReadMouStart: true,
      canEditMouStart: true,
      canReadMouEnd: true,
      canEditMouEnd: true,
      canReadEstimatedSubmission: true,
      canEditEstimatedSubmission: true,
    };

    const createInput = {
      id,
      sensitivity: Sensitivity.High, // TODO: this needs to be calculated based on language engagement
      step: ProjectStep.EarlyConversations,
      status: stepToStatus(ProjectStep.EarlyConversations),
      modifiedAt: DateTime.local(),
      ...input,
    };

    try {
      await this.db.createNode({
        session,
        input: createInput,
        acls,
        baseNodeLabel: 'Project',
        aclEditProp: 'canCreateProject',
      });

      // TODO: locations are not hooked up yet
      // if (locationId) {
      //   const query = `
      //     MATCH (location:Location {id: $locationId, active: true}),
      //       (project:Project {id: $id, active: true})
      //     CREATE (project)-[:location { active: true, createdAt: datetime()}]->(location)
      //     RETURN project.id as id
      //   `;

      //   await this.db
      //     .query()
      //     .raw(query, {
      //       locationId,
      //       id,
      //     })
      //     .first();
      // }

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning(`Could not create project`, {
        exception: e,
      });
      throw new Error('Could not create project');
    }
  }

  async update(input: UpdateProject, session: ISession): Promise<Project> {
    const object = await this.readOne(input.id, session);

    const changes = {
      ...input,
      modifiedAt: DateTime.local(),
      status: object.step.value
        ? stepToStatus(object.step.value)
        : object.status,
    };

    // TODO: re-connect the locationId node when locations are hooked up

    const result = await this.db.updateProperties({
      session,
      object,
      props: [
        'name',
        'mouStart',
        'mouEnd',
        'estimatedSubmission',
        'status',
        'modifiedAt',
      ],
      changes,
      nodevar: 'project',
    });

    return result;
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find project');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete project', {
        exception: e,
      });
      throw e;
    }
  }
}
