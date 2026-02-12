import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { type Many } from '@seedcompany/common';
import {
  type CalendarDate,
  ClientException,
  CreationFailed,
  EnhancedResource,
  type ID,
  InputException,
  many,
  NotFoundException,
  type ObjectView,
  type Range,
  RangeException,
  ReadAfterCreationFailed,
  RequiredWhen,
  Role,
  SecuredList,
  ServerException,
  UnauthorizedException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type AnyChangesOf } from '~/core/database/changes';
import { Hooks } from '~/core/hooks';
import { HandleIdLookup } from '~/core/resources';
import { Privileges } from '../authorization';
import { BudgetService } from '../budget';
import { BudgetStatus, type SecuredBudget } from '../budget/dto';
import { EngagementService } from '../engagement';
import {
  type EngagementListInput,
  type SecuredEngagementList,
} from '../engagement/dto';
import { LocationService } from '../location';
import {
  type LocationListInput,
  type SecuredLocationList,
} from '../location/dto';
import { PartnershipService } from '../partnership';
import {
  type PartnershipListInput,
  type SecuredPartnershipList,
} from '../partnership/dto';
import { ProjectChangeRequestService } from '../project-change-request';
import {
  type ProjectChangeRequestListInput,
  type SecuredProjectChangeRequestList,
} from '../project-change-request/dto';
import { User } from '../user/dto';
import {
  type CreateProject,
  InternshipProject,
  IProject,
  MomentumTranslationProject,
  MultiplicationTranslationProject,
  type Project,
  type ProjectListInput,
  ProjectStatus,
  ProjectType,
  ProjectUpdate,
  resolveProjectType,
  type SecuredProjectList,
  TranslationProject,
  type UpdateProject,
} from './dto';
import {
  ProjectCreatedHook,
  ProjectDeletedHook,
  ProjectUpdatedHook,
} from './hooks';
import { ProjectMemberService } from './project-member';
import {
  type ProjectMemberListInput,
  type SecuredProjectMemberList,
} from './project-member/dto';
import { ProjectChannels } from './project.channels';
import { ProjectRepository } from './project.repository';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectMembers: ProjectMemberService,
    private readonly locationService: LocationService,
    @Inject(forwardRef(() => BudgetService))
    private readonly budgetService: BudgetService & {},
    @Inject(forwardRef(() => PartnershipService))
    private readonly partnerships: PartnershipService & {},
    @Inject(forwardRef(() => EngagementService))
    private readonly engagementService: EngagementService & {},
    private readonly privileges: Privileges,
    private readonly identity: Identity,
    private readonly hooks: Hooks,
    private readonly channels: ProjectChannels,
    private readonly repo: ProjectRepository,
    private readonly projectChangeRequests: ProjectChangeRequestService,
  ) {}

  async create(input: CreateProject): Promise<UnsecuredDto<Project>> {
    ProjectDateRangeException.throwIfInvalid(input);
    if (input.type !== ProjectType.Internship && input.sensitivity) {
      throw new InputException(
        'Can only set sensitivity on Internship Projects',
        'sensitivity',
      );
    }
    this.privileges.for(IProject).verifyCan('create');

    await this.validateOtherResourceId(
      input.fieldRegion,
      'FieldRegion',
      'fieldRegion',
      'Field region not found',
    );
    await this.validateOtherResourceId(
      input.primaryLocation,
      'Location',
      'primaryLocation',
      'Primary location not found',
    );
    await this.validateOtherResourceId(
      input.otherLocations,
      'Location',
      'otherLocations',
      'One of the other locations was not found',
    );
    await this.validateOtherResourceId(
      input.marketingLocation,
      'Location',
      'marketingLocation',
      'Marketing location not found',
    );
    await this.validateOtherResourceId(
      input.marketingRegionOverride,
      'Location',
      'marketingRegionOverride',
      'Marketing Region Override not found',
    );

    // Only allow admins to specify department IDs
    if (input.departmentId && !this.identity.isImpersonatorAdmin) {
      throw UnauthorizedException.fromPrivileges(
        'edit',
        undefined,
        EnhancedResource.of(IProject),
        'departmentId',
      );
    }

    try {
      const { id } = await this.repo.create(input);
      const project = await this.readOneUnsecured(id).catch((e) => {
        throw e instanceof NotFoundException
          ? new ReadAfterCreationFailed(IProject)
          : e;
      });

      RequiredWhen.verify(IProject, project);

      // Add creator to the project team with their global roles
      const session = this.identity.current;
      await this.projectMembers.create(
        {
          user: session.userId,
          roles: session.roles
            .values()
            .filter((role) => Role.applicableToProjectMembership.has(role))
            .toArray(),
          project,
        },
        false,
      );
      // Skip another read query to fetch the fresh isMember flag
      // and assign it directly.
      Object.assign(project, {
        isMember: true,
        scope: ['member:true'],
      });

      const event = new ProjectCreatedHook(project);
      await this.hooks.run(event);

      this.channels.publishToAll('created', {
        program: project.type,
        project: project.id,
        at: project.createdAt,
      });

      return event.project;
    } catch (e) {
      if (e instanceof ClientException) {
        throw e;
      }
      throw new CreationFailed(IProject, { cause: e });
    }
  }

  @HandleIdLookup([
    TranslationProject,
    MomentumTranslationProject,
    MultiplicationTranslationProject,
  ])
  async readOneTranslation(
    id: ID,
    view?: ObjectView,
  ): Promise<TranslationProject> {
    const project = await this.readOne(id, view?.changeset);
    if (project.type === ProjectType.Internship) {
      throw new Error('Project is not a translation project');
    }
    return project as TranslationProject;
  }

  @HandleIdLookup(InternshipProject)
  async readOneInternship(
    id: ID,
    view?: ObjectView,
  ): Promise<InternshipProject> {
    const project = await this.readOne(id, view?.changeset);
    if (project.type !== ProjectType.Internship) {
      throw new Error('Project is not an internship project');
    }
    return project as InternshipProject;
  }

  async readOneUnsecured(
    id: ID,
    changeset?: ID,
  ): Promise<UnsecuredDto<Project>> {
    return await this.repo.readOne(id, changeset);
  }

  async readMany(
    ids: readonly ID[],
    view: ObjectView,
  ): Promise<readonly Project[]> {
    const projects = await this.repo.readMany(ids, view.changeset);
    return await Promise.all(projects.map((dto) => this.secure(dto)));
  }

  secure(project: UnsecuredDto<Project>) {
    return this.privileges.for(IProject, project).secure(project);
  }

  async readOne(id: ID, changeset?: ID): Promise<Project> {
    const unsecured = await this.readOneUnsecured(id, changeset);
    return this.secure(unsecured);
  }

  async update(input: UpdateProject, changeset?: ID) {
    const currentProject = await this.readOneUnsecured(input.id, changeset);
    if (input.sensitivity && currentProject.type !== ProjectType.Internship)
      throw new InputException(
        'Can only set sensitivity on Internship Projects',
        'sensitivity',
      );

    const changes = this.repo.getActualChanges(currentProject, input);
    this.privileges
      .for(resolveProjectType(currentProject), currentProject)
      .verifyChanges(changes, { pathPrefix: 'project' });
    if (Object.keys(changes).length === 0) {
      return { project: currentProject };
    }

    ProjectDateRangeException.throwIfInvalid(currentProject, changes);

    if (changes.primaryLocation) {
      try {
        const location = await this.locationService.readOne(
          changes.primaryLocation,
        );
        if (!location.fundingAccount.value) {
          throw new InputException(
            'Cannot connect location without a funding account',
            'primaryLocation',
          );
        }
      } catch (e) {
        if (e instanceof NotFoundException) {
          throw new NotFoundException(
            'Primary location not found',
            'primaryLocation',
            e,
          );
        }
        throw e;
      }
    }

    await this.validateOtherResourceId(
      changes.fieldRegion,
      'FieldRegion',
      'fieldRegion',
      'Field region not found',
    );

    const updated = await this.repo.update(currentProject, changes, changeset);

    const prevMissing = RequiredWhen.calc(IProject, currentProject);
    const nowMissing = RequiredWhen.calc(IProject, updated);
    if (
      nowMissing &&
      (!prevMissing || nowMissing.missing.length >= prevMissing.missing.length)
    ) {
      throw nowMissing;
    }

    const event = new ProjectUpdatedHook(updated, currentProject, {
      id: updated.id,
      ...changes,
    });
    await this.hooks.run(event);

    const updatedPayload = this.channels.publishToAll('updated', {
      program: updated.type,
      project: updated.id,
      at: changes.modifiedAt!,
      updated: ProjectUpdate.fromInput(changes),
      previous: ProjectUpdate.pickPrevious(currentProject, changes),
    });
    return {
      project: event.updated,
      payload: updatedPayload,
    };
  }

  async delete(id: ID) {
    const object = await this.readOneUnsecured(id);

    this.privileges.for(IProject, object).verifyCan('delete');

    const { at } = await this.repo.deleteNode(object).catch((e) => {
      throw new ServerException('Failed to delete project', e);
    });

    await this.hooks.run(new ProjectDeletedHook(object));

    return this.channels.publishToAll('deleted', {
      program: object.type,
      project: object.id,
      at,
    });
  }

  async list(input: ProjectListInput) {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  async listEngagements(
    project: Project,
    input: EngagementListInput,
    view?: ObjectView,
  ): Promise<SecuredEngagementList> {
    const result = await this.engagementService.list(
      {
        ...input,
        filter: {
          ...input.filter,
          project: {
            ...input.filter?.project,
            id: project.id,
          },
        },
      },
      view,
    );
    const perms = this.privileges.for(IProject, {
      ...project,
      project,
    } as any);

    return {
      ...result,
      canRead: perms.can('read', 'engagement'),
      canCreate: perms.can('create', 'engagement'),
    };
  }

  async listProjectMembers(
    project: Project,
    input: ProjectMemberListInput,
  ): Promise<SecuredProjectMemberList> {
    const result = await this.projectMembers.list({
      ...input,
      filter: {
        ...input.filter,
        project: {
          ...input.filter?.project,
          id: project.id,
        },
      },
    });

    const perms = this.privileges.for(IProject, project).all.member;

    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async listPartnerships(
    project: Project,
    input: PartnershipListInput,
    changeset?: ID,
  ): Promise<SecuredPartnershipList> {
    const result = await this.partnerships.list(
      {
        ...input,
        filter: {
          ...input.filter,
          projectId: project.id,
        },
      },
      changeset,
    );
    const perms = this.privileges.for(IProject, project);
    return {
      ...result,
      canRead: perms.can('read', 'partnership'),
      canCreate: perms.can('create', 'partnership'),
    };
  }

  async listChangeRequests(
    project: Project,
    input: ProjectChangeRequestListInput,
  ): Promise<SecuredProjectChangeRequestList> {
    const result = await this.projectChangeRequests.list({
      ...input,
      filter: {
        ...input.filter,
        projectId: project.id,
      },
    });

    return {
      ...result,
      canRead: true,
      canCreate: project.status === ProjectStatus.Active,
    };
  }

  async listProjectsByUserId(
    userId: ID,
    input: ProjectListInput,
  ): Promise<SecuredProjectList> {
    // Instead of trying to handle which subset of projects should be included,
    // based on doing the work of seeing which project teams they can view,
    // we'll use this course all/nothing check. This, assuming role permissions
    // are set correctly, allows the users which can view all projects & their members
    // to use this feature.
    const perms = this.privileges.for(User).all.projects;

    if (!perms.read) {
      return SecuredList.Redacted;
    }

    const result = await this.list({
      ...input,
      filter: {
        ...input.filter,
        userId,
      },
    });

    return {
      ...result,
      canRead: true, // false handled above
      canCreate: false, // This flag doesn't make sense here
    };
  }

  async addOtherLocation(project: ID<'Project'>, location: ID<'Location'>) {
    const changedAt = await this.locationService.addLocationToNode(
      'Project',
      project,
      'otherLocations',
      location,
    );
    if (!changedAt) {
      return undefined;
    }
    const proj = await this.repo.readOne(project);
    return this.channels.publishToAll('updated', {
      program: proj.type,
      project: project,
      at: changedAt,
      updated: { otherLocations: { Added: [location] } },
      previous: {},
    });
  }

  async removeOtherLocation(project: ID<'Project'>, location: ID<'Location'>) {
    const changedAt = await this.locationService.removeLocationFromNode(
      'Project',
      project,
      'otherLocations',
      location,
    );
    if (!changedAt) {
      return undefined;
    }
    const proj = await this.repo.readOne(project);
    return this.channels.publishToAll('updated', {
      program: proj.type,
      project,
      at: changedAt,
      updated: { otherLocations: { Removed: [location] } },
      previous: {},
    });
  }

  async listOtherLocations(
    project: Project,
    input: LocationListInput,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(IProject, project).forEdge('otherLocations'),
      project,
      input,
    );
  }

  async currentBudget(
    project: IProject,
    changeset?: ID,
  ): Promise<SecuredBudget> {
    let budgetToReturn;
    const perms = this.privileges.for(IProject, project).forEdge('budget');

    if (perms.can('read')) {
      const budgets = await this.budgetService.listUnsecure(
        {
          filter: {
            projectId: project.id,
          },
        },
        changeset,
      );

      const current = budgets.items.find(
        (b) => b.status === BudgetStatus.Current,
      );

      // #574 - if no current budget, then fallback to the first pending budget
      budgetToReturn = current ?? budgets.items[0];
    }

    return {
      value: budgetToReturn,
      canRead: perms.can('read'),
      canEdit: perms.can('edit'),
    };
  }

  async getPrimaryOrganizationName(id: ID) {
    return await this.repo.getPrimaryOrganizationName(id);
  }

  protected async validateOtherResourceId(
    ids: Many<ID> | null | undefined,
    label: string,
    resourceField: string,
    errMsg: string,
  ): Promise<void> {
    await Promise.all(
      many(ids ?? []).map(async (id, index) => {
        const exists = await this.repo.getBaseNode(id, label);
        if (exists) {
          return;
        }
        throw new NotFoundException(
          errMsg,
          `${resourceField}${Array.isArray(ids) ? `[${index}]` : ''}`,
        );
      }),
    );
  }
}

class ProjectDateRangeException extends RangeException {
  static throwIfInvalid(
    current: Partial<Pick<UnsecuredDto<Project>, 'mouStart' | 'mouEnd'>>,
    changes: AnyChangesOf<Project> = {},
  ) {
    const start =
      changes.mouStart !== undefined ? changes.mouStart : current.mouStart;
    const end = changes.mouEnd !== undefined ? changes.mouEnd : current.mouEnd;
    if (start && end && start > end) {
      const field = changes.mouEnd ? 'project.mouEnd' : 'project.mouStart';
      throw new ProjectDateRangeException({ start, end }, field);
    }
  }

  constructor(
    readonly value: Range<CalendarDate>,
    readonly field: string,
  ) {
    const message = "Project's MOU start date must be before the MOU end date";
    super({ message, field });
  }
}
