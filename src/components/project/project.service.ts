import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Many } from '@seedcompany/common';
import {
  DuplicateException,
  ID,
  InputException,
  isIdLike,
  many,
  NotFoundException,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import {
  ConfigService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  Transactional,
  UniquenessError,
} from '~/core';
import { Privileges, withoutScope } from '../authorization';
import { BudgetService, BudgetStatus, SecuredBudget } from '../budget';
import {
  EngagementListInput,
  EngagementService,
  SecuredEngagementList,
} from '../engagement';
import {
  LocationListInput,
  LocationService,
  SecuredLocationList,
} from '../location';
import { PartnerService } from '../partner';
import {
  PartnershipListInput,
  PartnershipService,
  SecuredPartnershipList,
} from '../partnership';
import { ProjectChangeRequestService } from '../project-change-request';
import {
  ProjectChangeRequestListInput,
  SecuredProjectChangeRequestList,
} from '../project-change-request/dto';
import { User } from '../user';
import {
  CreateProject,
  InternshipProject,
  IProject,
  Project,
  ProjectListInput,
  ProjectStatus,
  ProjectType,
  resolveProjectType,
  TranslationProject,
  UpdateProject,
} from './dto';
import {
  ProjectCreatedEvent,
  ProjectDeletedEvent,
  ProjectUpdatedEvent,
} from './events';
import {
  ProjectMemberListInput,
  ProjectMemberService,
  SecuredProjectMemberList,
} from './project-member';
import { ProjectRepository } from './project.repository';
import { ProjectRules } from './project.rules';

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
    @Inject(forwardRef(() => PartnerService))
    private readonly partnerService: PartnerService & {},
    private readonly config: ConfigService,
    private readonly privileges: Privileges,
    private readonly eventBus: IEventBus,
    private readonly projectRules: ProjectRules,
    private readonly repo: ProjectRepository,
    private readonly projectChangeRequests: ProjectChangeRequestService,
    @Logger('project:service') private readonly logger: ILogger,
  ) {}

  async create(
    input: CreateProject,
    session: Session,
  ): Promise<UnsecuredDto<Project>> {
    if (input.type === ProjectType.Translation && input.sensitivity) {
      throw new InputException(
        'Cannot set sensitivity on translation project',
        'project.sensitivity',
      );
    }
    this.privileges.for(session, IProject).verifyCan('create');

    await this.validateOtherResourceId(
      input.fieldRegionId,
      'FieldRegion',
      'fieldRegionId',
      'Field region not found',
    );
    await this.validateOtherResourceId(
      input.primaryLocationId,
      'Location',
      'primaryLocationId',
      'Primary location not found',
    );
    await this.validateOtherResourceId(
      input.otherLocationIds,
      'Location',
      'otherLocationIds',
      'One of the other locations was not found',
    );
    await this.validateOtherResourceId(
      input.marketingLocationId,
      'Location',
      'marketingLocationId',
      'Marketing location not found',
    );
    await this.validateOtherResourceId(
      input.marketingRegionOverrideId,
      'Location',
      'marketingRegionOverrideId',
      'Marketing Region Override not found',
    );

    try {
      const { id } = await this.repo.create(input);
      const project = await this.readOneUnsecured(id, session);

      // Add creator to the project team with their global roles
      await this.projectMembers.create(
        {
          userId: session.userId,
          roles: session.roles.map(withoutScope),
          projectId: project,
        },
        session,
        false,
      );
      // Skip another read query to fetch the fresh isMember flag
      // and assign it directly.
      Object.assign(project, {
        isMember: true,
        scope: ['member:true'],
      });

      const event = new ProjectCreatedEvent(project, session);
      await this.eventBus.publish(event);

      return event.project;
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'ProjectName') {
        throw new DuplicateException(
          'project.name',
          'Project with this name already exists',
        );
      }
      if (
        e instanceof NotFoundException ||
        e instanceof UnauthorizedException
      ) {
        throw e;
      }
      throw new ServerException(`Could not create project`, e);
    }
  }

  @HandleIdLookup(TranslationProject)
  async readOneTranslation(
    id: ID,
    session: Session,
    view?: ObjectView,
  ): Promise<TranslationProject> {
    const project = await this.readOne(id, session, view?.changeset);
    if (project.type !== ProjectType.Translation) {
      throw new Error('Project is not a translation project');
    }
    return project as TranslationProject;
  }

  @HandleIdLookup(InternshipProject)
  async readOneInternship(
    id: ID,
    session: Session,
    view?: ObjectView,
  ): Promise<InternshipProject> {
    const project = await this.readOne(id, session, view?.changeset);
    if (project.type !== ProjectType.Internship) {
      throw new Error('Project is not an internship project');
    }
    return project as InternshipProject;
  }

  async readOneUnsecured(
    id: ID,
    sessionOrUserId: Session | ID,
    changeset?: ID,
  ): Promise<UnsecuredDto<Project>> {
    const userId = isIdLike(sessionOrUserId)
      ? sessionOrUserId
      : sessionOrUserId.userId;
    return await this.repo.readOne(id, userId, changeset);
  }

  async readMany(
    ids: readonly ID[],
    session: Session,
    view: ObjectView,
  ): Promise<readonly Project[]> {
    this.logger.debug('read many', { ids, view });
    const projects = await this.repo.readMany(ids, session, view?.changeset);
    return await Promise.all(projects.map((dto) => this.secure(dto, session)));
  }

  secure(project: UnsecuredDto<Project>, session: Session) {
    return this.privileges.for(session, IProject, project).secure(project);
  }

  async readOne(id: ID, session: Session, changeset?: ID): Promise<Project> {
    const unsecured = await this.readOneUnsecured(id, session, changeset);
    return this.secure(unsecured, session);
  }

  @Transactional()
  async update(
    input: UpdateProject,
    session: Session,
    changeset?: ID,
    stepValidation = true,
  ): Promise<UnsecuredDto<Project>> {
    const currentProject = await this.readOneUnsecured(
      input.id,
      session,
      changeset,
    );
    if (input.sensitivity && currentProject.type === ProjectType.Translation)
      throw new InputException(
        'Cannot update sensitivity on Translation Project',
        'project.sensitivity',
      );

    const changes = this.repo.getActualChanges(currentProject, input);
    this.privileges
      .for(session, resolveProjectType(currentProject), currentProject)
      .verifyChanges(changes, { pathPrefix: 'project' });

    if (changes.step && stepValidation) {
      await this.projectRules.verifyStepChange(
        input.id,
        session,
        changes.step,
        changeset,
      );
    }

    if (changes.primaryLocationId) {
      try {
        const location = await this.locationService.readOne(
          changes.primaryLocationId,
          session,
        );
        if (!location.fundingAccount.value?.id) {
          throw new InputException(
            'Cannot connect location without a funding account',
            'project.primaryLocationId',
          );
        }
      } catch (e) {
        if (e instanceof NotFoundException) {
          throw new NotFoundException(
            'Primary location not found',
            'project.primaryLocationId',
            e,
          );
        }
        throw e;
      }
    }

    await this.validateOtherResourceId(
      changes.fieldRegionId,
      'FieldRegion',
      'fieldRegionId',
      'Field region not found',
    );

    const result = await this.repo.update(currentProject, changes, changeset);

    const event = new ProjectUpdatedEvent(
      result,
      currentProject,
      input,
      session,
    );
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOneUnsecured(id, session);

    this.privileges.for(session, IProject, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (e) {
      this.logger.warning('Failed to delete project', {
        exception: e,
      });
      throw new ServerException('Failed to delete project');
    }

    await this.eventBus.publish(new ProjectDeletedEvent(object, session));
  }

  async list(input: ProjectListInput, session: Session) {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }

  async listEngagements(
    project: Project,
    input: EngagementListInput,
    session: Session,
    view?: ObjectView,
  ): Promise<SecuredEngagementList> {
    this.logger.debug('list engagements ', {
      projectId: project.id,
      input,
      userId: session.userId,
    });

    const result = await this.engagementService.list(
      {
        ...input,
        filter: {
          ...input.filter,
          projectId: project.id,
        },
      },
      session,
      view,
    );
    const perms = this.privileges.for(session, IProject, {
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
    session: Session,
  ): Promise<SecuredProjectMemberList> {
    const result = await this.projectMembers.list(
      {
        ...input,
        filter: {
          ...input.filter,
          projectId: project.id,
        },
      },
      session,
    );

    const perms = this.privileges.for(session, IProject, project).all.member;

    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async listPartnerships(
    project: Project,
    input: PartnershipListInput,
    session: Session,
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
      session,
      changeset,
    );
    const perms = this.privileges.for(session, IProject, project);
    return {
      ...result,
      canRead: perms.can('read', 'partnership'),
      canCreate: perms.can('create', 'partnership'),
    };
  }

  async listChangeRequests(
    project: Project,
    input: ProjectChangeRequestListInput,
    session: Session,
  ): Promise<SecuredProjectChangeRequestList> {
    const result = await this.projectChangeRequests.list(
      {
        ...input,
        filter: {
          ...input.filter,
          projectId: project.id,
        },
      },
      session,
    );

    return {
      ...result,
      canRead: true,
      canCreate: project.status === ProjectStatus.Active,
    };
  }

  async listProjectsByUserId(
    userId: ID,
    input: ProjectListInput,
    session: Session,
  ) {
    // Instead of trying to handle which subset of projects should be included,
    // based on doing the work of seeing which project teams they can view,
    // we'll use this course all/nothing check. This, assuming role permissions
    // are set correctly, allows the users which can view all projects & their members
    // to use this feature.
    const perms = this.privileges.for(session, User).all.projects;

    if (!perms.read) {
      return SecuredList.Redacted;
    }

    const result = await this.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userId,
        },
      },
      session,
    );

    return {
      ...result,
      canRead: true, // false handled above
      canCreate: false, // This flag doesn't make sense here
    };
  }

  async addOtherLocation(
    projectId: ID,
    locationId: ID,
    _session: Session,
  ): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'Project',
        projectId,
        'otherLocations',
        locationId,
      );
    } catch (e) {
      throw new ServerException('Could not add other location to project', e);
    }
  }

  async removeOtherLocation(
    projectId: ID,
    locationId: ID,
    _session: Session,
  ): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'Project',
        projectId,
        'otherLocations',
        locationId,
      );
    } catch (e) {
      throw new ServerException(
        'Could not remove other location from project',
        e,
      );
    }
  }

  async listOtherLocations(
    project: Project,
    input: LocationListInput,
    session: Session,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(session, IProject, project).forEdge('otherLocations'),
      project,
      input,
    );
  }

  async currentBudget(
    project: IProject,
    session: Session,
    changeset?: ID,
  ): Promise<SecuredBudget> {
    let budgetToReturn;
    const perms = this.privileges
      .for(session, IProject, project)
      .forEdge('budget');

    if (perms.can('read')) {
      const budgets = await this.budgetService.listUnsecure(
        {
          filter: {
            projectId: project.id,
          },
        },
        session,
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
          `project.${resourceField}${Array.isArray(ids) ? `[${index}]` : ''}`,
        );
      }),
    );
  }
}
