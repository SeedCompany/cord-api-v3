import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  IEventBus,
  ILogger,
  Logger,
  OnIndex,
} from '../../core';
import { runListQuery } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectStatus } from '../project/dto';
import { ProjectService } from '../project/project.service';
import {
  CreateProjectChangeRequest,
  ProjectChangeRequest,
  ProjectChangeRequestListInput,
  ProjectChangeRequestListOutput,
  ProjectChangeRequestStatus,
  UpdateProjectChangeRequest,
} from './dto';
import { ProjectChangeRequestUpdatedEvent } from './events';
import { ProjectChangeRequestRepository } from './project-change-request.repository';

@Injectable()
export class ProjectChangeRequestService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('project:change-request:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly repo: ProjectChangeRequestRepository
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:ProjectChangeRequest) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:ProjectChangeRequest) ASSERT n.id IS UNIQUE',
    ];
  }

  async create(
    { projectId, ...input }: CreateProjectChangeRequest,
    session: Session
  ): Promise<ProjectChangeRequest> {
    // TODO
    // Project status should be active
    // const project = await this.projectService.readOne(projectId, session);
    // if (project.status !== ProjectStatus.Active) {
    //   throw new InputException(
    //     'Project status should be Active',
    //     'project.status'
    //   );
    // }
    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'summary',
        value: input.summary,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'status',
        value: input.status,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const result = await this.repo.create(session, secureProps);
    if (!result) {
      throw new ServerException('failed to create project change request');
    }

    await this.db
      .query()
      .match([
        [node('changeset', 'Changeset', { id: result.id })],
        [node('project', 'Project', { id: projectId })],
      ])
      .create([
        node('project'),
        relation('out', '', 'changeset', { active: true, createdAt }),
        node('changeset'),
      ])
      .return('changeset.id as id')
      .first();

    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<ProjectChangeRequest> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException('Could not find project change request');
    }

    const securedProps = await this.authorizationService.secureProperties(
      ProjectChangeRequest,
      result.props,
      session,
      result.scopedRoles
    );

    return {
      ...result.props,
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    input: UpdateProjectChangeRequest,
    session: Session
  ): Promise<ProjectChangeRequest> {
    const object = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(object, input);

    await this.db.updateProperties({
      type: ProjectChangeRequest,
      object,
      changes,
    });
    const updated = await this.readOne(input.id, session);

    const event = new ProjectChangeRequestUpdatedEvent(
      updated,
      object,
      input,
      session
    );
    await this.eventBus.publish(event);

    return updated;
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this project change request'
      );

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete project change request', {
        exception,
      });
      throw new ServerException('Failed to delete project change request');
    }
  }

  async list(
    { filter, ...input }: ProjectChangeRequestListInput,
    session: Session
  ): Promise<ProjectChangeRequestListOutput> {
    const query = this.repo.list({ filter, ...input }, session);
    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async canEdit(
    projectChangeRequest: ProjectChangeRequest,
    session: Session
  ): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'changeset', { active: true }),
        node('changeset', 'Changeset', { id: projectChangeRequest.id }),
      ])
      .return('project.id as projectId')
      .asResult<{ projectId: ID }>()
      .first();

    if (!result?.projectId) {
      return false;
    }
    const project = await this.projectService.readOne(
      result.projectId,
      session
    );

    return (
      project.status === ProjectStatus.Active &&
      projectChangeRequest.status.value === ProjectChangeRequestStatus.Pending
    );
  }
}
