import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, Sensitivity } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import {
  EngagementListInput,
  SecuredInternshipEngagementList,
  SecuredLanguageEngagementList,
} from '../engagement/dto';
import { LocationService } from '../location';
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
import {
  ProjectMemberListInput,
  ProjectMemberService,
  SecuredProjectMemberList,
} from './project-member';

@Injectable()
export class ProjectService {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectMembers: ProjectMemberService,
    private readonly locationService: LocationService,
    @Logger('project:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:step]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:step]-() ASSERT EXISTS(r.createdAt)',
      'CREATE CONSTRAINT ON (n:ProjectStep) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:ProjectStep) ASSERT EXISTS(n.value)',

      'CREATE CONSTRAINT ON ()-[r:status]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:status]-() ASSERT EXISTS(r.createdAt)',
      'CREATE CONSTRAINT ON (n:ProjectStatus) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:ProjectStatus) ASSERT EXISTS(n.value)',

      'CREATE CONSTRAINT ON (n:ProjectName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:ProjectName) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

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

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLocation:ACL {canReadLocation: true})-[:toNode]->(project)-[:location {active: true}]->(country:Country {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditLocation:ACL {canEditLocation: true})-[:toNode]->(project)
        WITH * OPTIONAL MATCH (country)-[:region]->(region:Region {active:true})-[:zone]->(zone:Zone {active: true})

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
          country,
          region,
          zone,
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

    const location = result.country
      ? this.locationService
          .readOneCountry(result.country.properties.id, session)
          .then((country) => {
            return {
              value: {
                id: country.id,
                name: { ...country.name },
                region: { ...country.region },
                createdAt: country.createdAt,
              },
            };
          })
          .catch(() => {
            return {
              value: undefined,
            };
          })
      : {
          value: undefined,
        };

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
        ...location,
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
      items: result.items.map((item) => ({
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

  async listProjectMembers(
    projectId: string,
    input: ProjectMemberListInput,
    session: ISession
  ): Promise<SecuredProjectMemberList> {
    const result = await this.projectMembers.list(
      {
        ...input,
        filter: {
          ...input.filter,
          projectId: projectId,
        },
      },
      session
    );

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
    };
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
      canReadStep: true,
      canEditStep: true,
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
        type: Project.classType,
        input: createInput,
        acls,
      });
      const qry = `
        MATCH
          (project:Project {id: "${id}", active: true})-[:name]->(proName:Property),
          (project:Project)-[:step]->(proStep:Property {active: true}),
          (project:Project)-[:status]->(proStatus:Property {active: true})
        SET proName :ProjectName, proStep :ProjectStep, proStatus :ProjectStatus
        RETURN project.id
      `;
      await this.db
        .query()
        .raw(qry, {
          id,
        })
        .run();

      if (locationId) {
        const query = `
            MATCH (country:Country {id: $locationId, active: true}),
              (project:Project {id: $id, active: true})
            CREATE (project)-[:location { active: true, createdAt: datetime()}]->(country)
            RETURN project.id as id
          `;

        await this.db
          .query()
          .raw(query, {
            locationId,
            id,
          })
          .first();
      }

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning(`Could not create project`, {
        exception: e,
      });
      throw new Error(e);
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

  async consistencyChecker(session: ISession): Promise<boolean> {
    const projects = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('project', 'Project', {
            active: true,
          }),
        ],
      ])
      .return('project.id as id')
      .run();

    const hasConsistentSingleton = await Promise.all(
      projects.map(async (project) => {
        return this.db.isRelationshipUnique({
          session,
          id: project.id,
          relName: 'location',
          srcNodeLabel: 'Project',
          desNodeLabel: 'Country',
        });
      })
    );

    const hasConsistentProperties = await Promise.all(
      projects.map(async (project) => {
        return this.db.hasProperties({
          session,
          id: project.id,
          props: ['type', 'status', 'name', 'step'],
          nodevar: 'Project',
        });
      })
    );
    return [...hasConsistentSingleton, ...hasConsistentProperties].every(
      (n) => n
    );
  }
}
