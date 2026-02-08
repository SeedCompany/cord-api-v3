import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  NotFoundException,
  type ObjectView,
  ReadAfterCreationFailed,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '~/core';
import { DatabaseService } from '~/core/database';
import { mapListResults } from '~/core/database/results';
import { Privileges } from '../authorization';
import { ChangesetFinalizingHook } from '../changeset';
import { ProjectService } from '../project';
import { ProjectStatus } from '../project/dto';
import {
  type CreateProjectChangeRequest,
  ProjectChangeRequest,
  type ProjectChangeRequestListInput,
  type ProjectChangeRequestListOutput,
  ProjectChangeRequestStatus as Status,
  type UpdateProjectChangeRequest,
} from './dto';
import { ProjectChangeRequestApprovedHook } from './hooks';
import { ProjectChangeRequestRepository } from './project-change-request.repository';

@Injectable()
export class ProjectChangeRequestService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('project:change-request:service') private readonly logger: ILogger,
    private readonly privileges: Privileges,
    private readonly hooks: Hooks,
    @Inject(forwardRef(() => ProjectService))
    private readonly projects: ProjectService & {},
    private readonly repo: ProjectChangeRequestRepository,
  ) {}

  async create(
    input: CreateProjectChangeRequest,
  ): Promise<ProjectChangeRequest> {
    this.privileges.for(ProjectChangeRequest).verifyCan('create');

    const project = await this.projects.readOne(input.project);
    if (project.status !== ProjectStatus.Active) {
      throw new InputException(
        'Only active projects can create change requests',
      );
    }

    const id = await this.repo.create(input);

    return await this.readOne(id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(ProjectChangeRequest)
        : e;
    });
  }

  @HandleIdLookup(ProjectChangeRequest)
  async readOne(id: ID, _view?: ObjectView): Promise<ProjectChangeRequest> {
    const dto = await this.readOneUnsecured(id);
    return await this.secure(dto);
  }

  async readMany(ids: readonly ID[]) {
    const projectChangeRequests = await this.repo.readMany(ids);
    return await Promise.all(
      projectChangeRequests.map((dto) => this.secure(dto)),
    );
  }

  async readOneUnsecured(id: ID): Promise<UnsecuredDto<ProjectChangeRequest>> {
    return await this.repo.readOne(id);
  }

  async secure(
    dto: UnsecuredDto<ProjectChangeRequest>,
  ): Promise<ProjectChangeRequest> {
    return {
      ...this.privileges.for(ProjectChangeRequest).secure(dto),
      __typename: 'ProjectChangeRequest',
    };
  }

  async update(
    input: UpdateProjectChangeRequest,
  ): Promise<ProjectChangeRequest> {
    const object = await this.readOneUnsecured(input.id);
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
    const updated = await this.readOneUnsecured(input.id);

    if (isStatusChanged) {
      await this.hooks.run(new ChangesetFinalizingHook(updated));
      if (changes.status === Status.Approved) {
        await this.hooks.run(
          new ProjectChangeRequestApprovedHook(updated),
        );
      }
    }

    return await this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(ProjectChangeRequest, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete project change request', {
        exception,
      });
      throw new ServerException('Failed to delete project change request');
    }
  }

  async list(
    input: ProjectChangeRequestListInput,
  ): Promise<ProjectChangeRequestListOutput> {
    // no need to check if canList for now, all roles allow for listing.
    const results = await this.repo.list(input);
    return await mapListResults(results, (dto) => this.secure(dto));
  }
}
