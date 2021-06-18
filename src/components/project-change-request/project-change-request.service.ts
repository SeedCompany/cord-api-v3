import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  OnIndex,
} from '../../core';
import { runListQuery } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateProjectChangeRequest,
  ProjectChangeRequest,
  ProjectChangeRequestListInput,
  ProjectChangeRequestListOutput,
  ProjectChangeRequestStatus as Status,
  UpdateProjectChangeRequest,
} from './dto';
import { ProjectChangeRequestApprovedEvent } from './events';
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
    input: CreateProjectChangeRequest,
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
    const id = await this.repo.create(input, session);

    return await this.readOne(id, session);
  }

  @HandleIdLookup(ProjectChangeRequest)
  async readOne(id: ID, session: Session): Promise<ProjectChangeRequest> {
    const dto = await this.readOneUnsecured(id, session);
    return await this.secure(dto, session);
  }

  async readOneUnsecured(
    id: ID,
    session: Session
  ): Promise<UnsecuredDto<ProjectChangeRequest>> {
    return await this.repo.readOne(id, session);
  }

  async secure(
    dto: UnsecuredDto<ProjectChangeRequest>,
    session: Session
  ): Promise<ProjectChangeRequest> {
    const securedProps = await this.authorizationService.secureProperties(
      ProjectChangeRequest,
      dto,
      session,
      dto.scope
    );
    return {
      ...dto,
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(dto.id, session),
    };
  }

  async update(
    input: UpdateProjectChangeRequest,
    session: Session
  ): Promise<ProjectChangeRequest> {
    const object = await this.readOneUnsecured(input.id, session);
    const changes = this.repo.getActualChanges(object, input);

    await this.db.updateProperties({
      type: ProjectChangeRequest,
      object,
      changes,
    });
    const updated = await this.readOneUnsecured(input.id, session);

    if (
      object.status === Status.Pending &&
      changes.status === Status.Approved
    ) {
      await this.eventBus.publish(
        new ProjectChangeRequestApprovedEvent(updated, session)
      );
    }

    return await this.secure(updated, session);
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
}
