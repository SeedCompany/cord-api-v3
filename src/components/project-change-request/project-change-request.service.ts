import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  ObjectView,
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
} from '../../core';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
import { ChangesetFinalizingEvent } from '../changeset/events';
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
    private readonly privileges: Privileges,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => ProjectService))
    private readonly projects: ProjectService,
    private readonly repo: ProjectChangeRequestRepository
  ) {}

  async create(
    input: CreateProjectChangeRequest,
    session: Session
  ): Promise<ProjectChangeRequest> {
    this.privileges.for(session, ProjectChangeRequest).verifyCan('create');

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
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<ProjectChangeRequest> {
    const dto = await this.readOneUnsecured(id, session);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const projectChangeRequests = await this.repo.readMany(ids, session);
    return await Promise.all(
      projectChangeRequests.map((dto) => this.secure(dto, session))
    );
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
    const securedProps = this.privileges
      .for(session, ProjectChangeRequest)
      .secureProps(dto);
    return {
      ...dto,
      ...securedProps,
      types: {
        ...securedProps.types,
        value: securedProps.types.value ?? [],
      },
      canDelete: await this.db.checkDeletePermission(dto.id, session),
      __typename: 'ProjectChangeRequest',
    };
  }

  async update(
    input: UpdateProjectChangeRequest,
    session: Session
  ): Promise<ProjectChangeRequest> {
    const object = await this.readOneUnsecured(input.id, session);
    const changes = this.repo.getActualChanges(object, input);
    const isStatusChanged =
      object.status === Status.Pending &&
      (changes.status === Status.Approved ||
        changes.status === Status.Rejected);

    await this.db.updateProperties({
      type: ProjectChangeRequest,
      object,
      changes: {
        ...changes,
        ...(isStatusChanged
          ? { applied: changes.status === Status.Approved, editable: false }
          : {}),
      },
    });
    const updated = await this.readOneUnsecured(input.id, session);

    if (isStatusChanged) {
      await this.eventBus.publish(
        new ChangesetFinalizingEvent(updated, session)
      );
      if (changes.status === Status.Approved) {
        await this.eventBus.publish(
          new ProjectChangeRequestApprovedEvent(updated, session)
        );
      }
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
    // no need to check if canList for now, all roles allow for listing.
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
