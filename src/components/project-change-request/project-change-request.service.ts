import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
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
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectService, ProjectStatus } from '../project';
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
    @Inject(forwardRef(() => ProjectService))
    private readonly projects: ProjectService,
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
    const project = await this.projects.readOne(input.projectId, session);
    if (project.status !== ProjectStatus.Active) {
      throw new InputException(
        'Only active projects can create change requests'
      );
    }

    const id = await this.repo.create(input);

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
      types: {
        ...securedProps.types,
        value: securedProps.types.value ?? [],
      },
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
    input: ProjectChangeRequestListInput,
    session: Session
  ): Promise<ProjectChangeRequestListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (id) => this.readOne(id, session));
  }
}
