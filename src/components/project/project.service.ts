import { Injectable, NotImplementedException } from '@nestjs/common';
import { ISession } from '../auth';
import { generate } from 'shortid';
import {
  CreateProject,
  ProjectListInput,
  ProjectListOutput,
  UpdateProject,
  Project,
  stepToStatus,
  ProjectStep,
} from './dto';
import { PropertyUpdaterService, DatabaseService, ILogger, Logger } from '../../core';
import { Sensitivity } from '../../common';
import { DateTime } from 'luxon';

@Injectable()
export class ProjectService {
  constructor(
    private readonly db: DatabaseService,
    private readonly propertyUpdater: PropertyUpdaterService,
    @Logger('project:service') private readonly logger: ILogger,
  ) {}

  async readOne(id: string, session: ISession): Promise<Project> {
    throw new NotImplementedException();
  }

  async list(
    { page, count, sort, order, filter }: ProjectListInput,
    session: ISession,
  ): Promise<ProjectListOutput> {
    const result = await this.propertyUpdater.list<Project>({
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

  async create({ locationId, ...input }: CreateProject, session: ISession): Promise<Project> {
    const id = generate();
    const acls = {
      // these are not user-defined properties but should still be readable
      canReadType: true,
      canEditType: true,
      canReadName: true,
      canEditName: true,
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
      modifiedAt: DateTime.local().toNeo4JDateTime(),
      ...input,
    };

    try {
      await this.propertyUpdater.createNode({
        session,
        input: createInput,
        acls,
        baseNodeLabel: 'Project',
        aclEditProp: 'canCreateProject',
      });

      // TODO: locations don't appear to be hooked up yet
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

      return this.readOne(id, session);
    } catch (e) {
      this.logger.warning(`Could not create project`, {
        exception: e
      });
      throw new Error('Could not create project');
    }
  }

  async update(input: UpdateProject, session: ISession): Promise<Project> {
    throw new NotImplementedException();
  }

  async delete(id: string, session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}
