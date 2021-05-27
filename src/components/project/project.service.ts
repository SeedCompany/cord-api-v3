import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { entries, Many } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  getHighestSensitivity,
  ID,
  InputException,
  isIdLike,
  many,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import {
  ConfigService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  OnIndex,
  UniquenessError,
} from '../../core';
import {
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { rolesForScope, ScopedRole } from '../authorization/dto';
import { Powers } from '../authorization/dto/powers';
import { BudgetService, BudgetStatus, SecuredBudget } from '../budget';
import {
  EngagementListInput,
  EngagementService,
  SecuredEngagementList,
} from '../engagement';
import { FileService, SecuredDirectory } from '../file';
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
import { PlanChangeService } from './change-to-plan';
import {
  ChangeListInput,
  SecuredChangeList,
} from './change-to-plan/dto/change-list.dto';
import { PlanChangeStatus } from './change-to-plan/dto/plan-change-status.enum';
import {
  CreateProject,
  InternshipProject,
  IProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  ProjectStatus,
  ProjectType,
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
    private readonly budgetService: BudgetService,
    @Inject(forwardRef(() => PartnershipService))
    private readonly partnerships: PartnershipService,
    private readonly fileService: FileService,
    @Inject(forwardRef(() => EngagementService))
    private readonly engagementService: EngagementService,
    private readonly partnerService: PartnerService,
    private readonly config: ConfigService,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly projectRules: ProjectRules,
    private readonly repo: ProjectRepository,
    private readonly planChangeService: PlanChangeService,
    @Logger('project:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:DepartmentId) ASSERT n.value IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:step]-() ASSERT EXISTS(r.createdAt)',
      'CREATE CONSTRAINT ON ()-[r:status]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:status]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:ProjectName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(
    input: CreateProject,
    session: Session
  ): Promise<UnsecuredDto<Project>> {
    if (input.type === ProjectType.Translation && input.sensitivity) {
      throw new InputException(
        'Cannot set sensitivity on translation project',
        'project.sensitivity'
      );
    }
    await this.authorizationService.checkPower(Powers.CreateProject, session);

    await this.validateOtherResourceId(
      input.fieldRegionId,
      'FieldRegion',
      'fieldRegionId',
      'Field region not found'
    );
    await this.validateOtherResourceId(
      input.primaryLocationId,
      'Location',
      'primaryLocationId',
      'Primary location not found'
    );
    await this.validateOtherResourceId(
      input.otherLocationIds,
      'Location',
      'otherLocationIds',
      'One of the other locations was not found'
    );
    await this.validateOtherResourceId(
      input.marketingLocationId,
      'Location',
      'marketingLocationId',
      'Marketing location not found'
    );

    try {
      const id = await this.repo.create(input);

      // get the creating user's roles. Assign them on this project.
      // I'm going direct for performance reasons

      const roles = await this.repo.getRoles(session);

      if (!this.config.migration) {
        // Add creator to the project team if not in migration
        await this.projectMembers.create(
          {
            userId: session.userId,
            projectId: id,
            roles,
          },
          session
        );
      }

      await this.authorizationService.processNewBaseNode(
        IProject,
        id,
        session.userId
      );

      const project = await this.readOneUnsecured(id, session);

      await this.eventBus.publish(new ProjectCreatedEvent(project, session));

      return project;
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'ProjectName') {
        throw new DuplicateException(
          'project.name',
          'Project with this name already exists'
        );
      }
      if (e instanceof NotFoundException) {
        throw e;
      }
      throw new ServerException(`Could not create project`, e);
    }
  }

  @HandleIdLookup(TranslationProject)
  async readOneTranslation(
    id: ID,
    session: Session
  ): Promise<TranslationProject> {
    const project = await this.readOne(id, session);
    if (project.type !== ProjectType.Translation) {
      throw new Error('Project is not a translation project');
    }
    return project as TranslationProject;
  }

  @HandleIdLookup(InternshipProject)
  async readOneInternship(
    id: ID,
    session: Session
  ): Promise<InternshipProject> {
    const project = await this.readOne(id, session);
    if (project.type !== ProjectType.Internship) {
      throw new Error('Project is not an internship project');
    }
    return project as InternshipProject;
  }

  async readOneUnsecured(
    id: ID,
    sessionOrUserId: Session | ID,
    changeId?: ID
  ): Promise<UnsecuredDto<Project>> {
    const userId = isIdLike(sessionOrUserId)
      ? sessionOrUserId
      : sessionOrUserId.userId;
    const result = await this.repo.readOneUnsecured(id, userId);
    if (!result) {
      throw new NotFoundException('Could not find project');
    }

    const props = parsePropList(result.propList);
    let project = {
      ...parseBaseNodeProperties(result.node),
      ...props,
      // Sensitivity is calculated based on the highest language sensitivity (for Translation Projects).
      // If project has no language engagements (new Translation projects and all Internship projects),
      // then falls back to the sensitivity prop which defaulted to High on create for all projects.
      sensitivity:
        getHighestSensitivity(result.languageSensitivityList) ??
        props.sensitivity,
      type: result.node.properties.type,
      primaryLocation: result.primaryLocationId,
      marketingLocation: result.marketingLocationId,
      fieldRegion: result.fieldRegionId,
      owningOrganization: result.owningOrganizationId,
      pinned: !!result.pinnedRel,
      scope: result.memberRoles.flat().map(rolesForScope('project')),
    };

    if (changeId) {
      const planChangesProps = await this.repo.getPlanChangesProps(
        id,
        changeId
      );
      entries(planChangesProps).forEach(([key, prop]) => {
        if (prop !== undefined) {
          project = {
            ...project,
            [key]: prop,
          };
        }
      });
      project = {
        ...project,
        changeId,
      };
    }

    return project;
  }

  async secure(
    project: UnsecuredDto<Project>,
    sessionOrUserId: Session | ID
  ): Promise<Project> {
    const securedProps = await this.authorizationService.secureProperties(
      IProject,
      project,
      sessionOrUserId,
      project.scope
    );
    return {
      ...project,
      ...securedProps,
      primaryLocation: {
        value: securedProps.primaryLocation.canRead
          ? securedProps.primaryLocation.value
          : null,
        canRead: securedProps.primaryLocation.canRead,
        canEdit: securedProps.primaryLocation.canEdit,
      },
      canDelete: await this.repo.checkDeletePermission(
        project.id,
        sessionOrUserId
      ),
    };
  }

  async readOne(
    id: ID,
    sessionOrUserId: Session | ID,
    changeId?: ID
  ): Promise<Project> {
    const unsecured = await this.readOneUnsecured(
      id,
      sessionOrUserId,
      changeId
    );
    return await this.secure(unsecured, sessionOrUserId);
  }

  async update(
    input: UpdateProject,
    session: Session,
    changeId?: ID
  ): Promise<UnsecuredDto<Project>> {
    const currentProject = await this.readOneUnsecured(input.id, session);
    if (input.sensitivity && currentProject.type === ProjectType.Translation)
      throw new InputException(
        'Cannot update sensitivity on Translation Project',
        'project.sensitivity'
      );

    const changes = this.repo.getActualChanges(currentProject, input);
    await this.authorizationService.verifyCanEditChanges(
      currentProject.type === 'Translation'
        ? TranslationProject
        : InternshipProject,
      await this.secure(currentProject, session),
      changes,
      'project'
    );

    if (changes.step) {
      await this.projectRules.verifyStepChange(
        input.id,
        session,
        changes.step,
        changeId
      );
    }

    const {
      primaryLocationId,
      marketingLocationId,
      fieldRegionId,
      ...simpleChanges
    } = changes;

    // In CR mode, Project status should be Active and CR status is pending
    if (changeId) {
      const planChange = await this.planChangeService.readOne(
        changeId,
        session
      );
      if (
        currentProject.status !== ProjectStatus.Active ||
        planChange.status.value !== PlanChangeStatus.Pending
      ) {
        throw new InputException(
          'Project status is not Active or CR is not pending',
          'project.status'
        );
      }
    }
    let result = await this.repo.updateProperties(
      currentProject,
      simpleChanges,
      changeId
    );

    if (changeId) {
      return currentProject;
    }

    if (primaryLocationId) {
      try {
        const location = await this.locationService.readOne(
          primaryLocationId,
          session
        );
        if (!location.fundingAccount.value) {
          throw new InputException(
            'Cannot connect location without a funding account',
            'project.primaryLocationId'
          );
        }
      } catch (e) {
        if (e instanceof NotFoundException) {
          throw new NotFoundException(
            'Primary location not found',
            'project.primaryLocationId',
            e
          );
        }
        throw e;
      }

      const createdAt = DateTime.local();

      await this.repo.updateLocation(input, createdAt);

      result = {
        ...result,
        primaryLocation: primaryLocationId,
      };
    }

    if (fieldRegionId) {
      await this.validateOtherResourceId(
        fieldRegionId,
        'FieldRegion',
        'fieldRegionId',
        'Field region not found'
      );
      const createdAt = DateTime.local();
      await this.repo.updateFieldRegion(input, createdAt);
      result = {
        ...result,
        fieldRegion: fieldRegionId,
      };
    }

    const event = new ProjectUpdatedEvent(
      result,
      currentProject,
      input,
      session
    );
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOneUnsecured(id, session);
    if (!object) {
      throw new NotFoundException('Could not find project');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Project'
      );

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

  async list(
    { filter, ...input }: ProjectListInput,
    session: Session
  ): Promise<ProjectListOutput> {
    const label = `${filter.type ?? ''}Project`;
    const projectSortMap: Partial<Record<typeof input.sort, string>> = {
      name: 'toLower(prop.sortValue)',
      sensitivity: 'sensitivityValue',
    };

    const sortBy = projectSortMap[input.sort] ?? 'prop.value';

    const query = this.repo.list(label, sortBy, { filter, ...input }, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listEngagements(
    project: Project,
    input: EngagementListInput,
    session: Session,
    changeId?: ID
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
      changeId
    );

    const permissions = await this.repo.permissionsForListProp(
      'engagement',
      project.id,
      session
    );

    return {
      ...result,
      ...permissions,
      canCreate:
        permissions.canCreate &&
        (project.status === ProjectStatus.InDevelopment ||
          session.roles.includes('global:Administrator')),
    };
  }

  async listProjectMembers(
    projectId: ID,
    input: ProjectMemberListInput,
    session: Session
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

    const permissions = await this.repo.permissionsForListProp(
      'member',
      projectId,
      session
    );

    return {
      ...result,
      ...permissions,
    };
  }

  async listPartnerships(
    projectId: ID,
    input: PartnershipListInput,
    session: Session
  ): Promise<SecuredPartnershipList> {
    const result = await this.partnerships.list(
      {
        ...input,
        filter: {
          ...input.filter,
          projectId: projectId,
        },
      },
      session
    );

    const permissions = await this.repo.permissionsForListProp(
      'partnership',
      projectId,
      session
    );

    return {
      ...result,
      ...permissions,
    };
  }

  async listPlanChanges(
    projectId: ID,
    input: ChangeListInput,
    session: Session
  ): Promise<SecuredChangeList> {
    const result = await this.planChangeService.list(
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

  async addOtherLocation(
    projectId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'Project',
        projectId,
        'otherLocations',
        locationId
      );
    } catch (e) {
      throw new ServerException('Could not add other location to project', e);
    }
  }

  async removeOtherLocation(
    projectId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'Project',
        projectId,
        'otherLocations',
        locationId
      );
    } catch (e) {
      throw new ServerException(
        'Could not remove other location from project',
        e
      );
    }
  }

  async listOtherLocations(
    project: Project,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      IProject,
      project,
      'otherLocations',
      input,
      session
    );
  }

  async currentBudget(
    { id, sensitivity }: Pick<Project, 'id' | 'sensitivity'>,
    session: Session
  ): Promise<SecuredBudget> {
    let budgetToReturn;

    const membershipRoles = await this.getMembershipRoles(id, session);
    const permsOfProject = await this.authorizationService.getPermissions({
      resource: IProject,
      sessionOrUserId: session,
      otherRoles: membershipRoles,
      sensitivity,
    });

    if (permsOfProject.budget.canRead) {
      const budgets = await this.budgetService.listNoSecGroups(
        {
          filter: {
            projectId: id,
          },
        },
        session
      );

      const current = budgets.items.find(
        (b) => b.status === BudgetStatus.Current
      );

      // #574 - if no current budget, then fallback to the first pending budget
      budgetToReturn = current ?? budgets.items[0];
    }

    return {
      value: budgetToReturn,
      canRead: permsOfProject.budget.canRead,
      canEdit: session.roles.includes('global:Administrator')
        ? true
        : permsOfProject.budget.canEdit &&
          budgetToReturn?.status === BudgetStatus.Pending,
    };
  }

  private async getMembershipRoles(
    projectId: ID | Project,
    session: Session
  ): Promise<ScopedRole[]> {
    if (!isIdLike(projectId)) {
      return projectId.scope;
    }

    const result = await this.repo.getMembershipRoles(projectId, session);

    return result?.memberRoles.flat().map(rolesForScope('project')) ?? [];
  }

  async getRootDirectory(
    projectId: ID,
    session: Session
  ): Promise<SecuredDirectory> {
    const rootRef = await this.repo.getRootDirectory(projectId, session);

    if (!rootRef) {
      return {
        canEdit: false,
        canRead: false,
        value: undefined,
      };
    }

    if (!rootRef?.id) {
      throw new NotFoundException(
        'Could not find root directory associated to this project'
      );
    }

    return {
      canEdit: false,
      canRead: true,
      value: await this.fileService.getDirectory(rootRef.id, session),
    };
  }

  protected async validateOtherResourceId(
    ids: Many<string> | undefined,
    label: string,
    resourceField: string,
    errMsg: string
  ): Promise<void> {
    await Promise.all(
      many(ids ?? []).map(async (id, index) => {
        const exists = await this.repo.validateOtherResourceId(id, label);
        if (exists) {
          return;
        }
        throw new NotFoundException(
          errMsg,
          `project.${resourceField}${Array.isArray(ids) ? `[${index}]` : ''}`
        );
      })
    );
  }
}
