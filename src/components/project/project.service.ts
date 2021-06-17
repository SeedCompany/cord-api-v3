import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Many } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  getHighestSensitivity,
  ID,
  InputException,
  isIdLike,
  many,
  NotFoundException,
  Sensitivity,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  IEventBus,
  ILogger,
  Logger,
  OnIndex,
  Property,
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
import { ReportPeriod } from '../periodic-report';
import {
  CreateProject,
  InternshipProject,
  IProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  stepToStatus,
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
    {
      primaryLocationId,
      otherLocationIds,
      marketingLocationId,
      fieldRegionId,
      ...input
    }: CreateProject,
    session: Session
  ): Promise<UnsecuredDto<Project>> {
    if (input.type === ProjectType.Translation && input.sensitivity) {
      throw new InputException(
        'Cannot set sensitivity on translation project',
        'project.sensitivity'
      );
    }
    await this.authorizationService.checkPower(Powers.CreateProject, session);

    const createdAt = DateTime.local();
    const step = input.step ?? ProjectStep.EarlyConversations;
    const createInput = {
      sensitivity: Sensitivity.High, // Default to high on create
      ...input,
      step,
      status: stepToStatus(step),
      modifiedAt: DateTime.local(),
    };
    const secureProps: Property[] = [
      {
        key: 'name',
        value: createInput.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProjectName',
        isDeburrable: true,
      },
      {
        key: 'sensitivity',
        value: createInput.sensitivity,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'step',
        value: createInput.step,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProjectStep',
      },
      {
        key: 'status',
        value: createInput.status,
        isPublic: true,
        isOrgPublic: false,
        label: 'ProjectStatus',
      },
      {
        key: 'mouStart',
        value: createInput.mouStart,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouEnd',
        value: createInput.mouEnd,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'initialMouEnd',
        value: undefined,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'stepChangedAt',
        value: createInput.modifiedAt,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'estimatedSubmission',
        value: createInput.estimatedSubmission,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'modifiedAt',
        value: createInput.modifiedAt,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'departmentId',
        value: null,
        isPublic: false,
        isOrgPublic: false,
        label: 'DepartmentId',
      },
      {
        key: 'tags',
        value: createInput.tags,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'financialReportReceivedAt',
        value: createInput.financialReportReceivedAt,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'financialReportPeriod',
        value: createInput.financialReportPeriod,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    try {
      const createProject = this.repo.createProject(session);

      if (fieldRegionId) {
        await this.validateOtherResourceId(
          fieldRegionId,
          'FieldRegion',
          'fieldRegionId',
          'Field region not found'
        );
        createProject.match([
          node('fieldRegion', 'FieldRegion', { id: fieldRegionId }),
        ]);
      }
      if (primaryLocationId) {
        await this.validateOtherResourceId(
          primaryLocationId,
          'Location',
          'primaryLocationId',
          'Primary location not found'
        );
        createProject.match([
          node('primaryLocation', 'Location', { id: primaryLocationId }),
        ]);
      }
      if (otherLocationIds?.length) {
        await this.validateOtherResourceId(
          otherLocationIds,
          'Location',
          'otherLocationIds',
          'One of the other locations was not found'
        );
        otherLocationIds.forEach((id) => {
          createProject.match([node(`otherLocation${id}`, 'Location', { id })]);
        });
      }
      if (marketingLocationId) {
        await this.validateOtherResourceId(
          marketingLocationId,
          'Location',
          'marketingLocationId',
          'Marketing location not found'
        );
        createProject.match([
          node('marketingLocation', 'Location', { id: marketingLocationId }),
        ]);
      }
      createProject.match([
        node('organization', 'Organization', { id: this.config.defaultOrg.id }),
      ]);

      createProject.apply(
        createBaseNode(
          await generateId(),
          `Project:${input.type}Project`,
          secureProps,
          {
            type: createInput.type,
          }
        )
      );

      if (fieldRegionId) {
        createProject.create([
          [
            node('node'),
            relation('out', '', 'fieldRegion', { active: true, createdAt }),
            node('fieldRegion'),
          ],
        ]);
      }
      if (primaryLocationId) {
        createProject.create([
          [
            node('node'),
            relation('out', '', 'primaryLocation', { active: true, createdAt }),
            node('primaryLocation'),
          ],
        ]);
      }
      if (otherLocationIds?.length) {
        otherLocationIds.forEach((id) => {
          createProject.create([
            [
              node('node'),
              relation('out', '', 'otherLocations', {
                active: true,
                createdAt,
              }),
              node(`otherLocation${id}`),
            ],
          ]);
        });
      }
      if (marketingLocationId) {
        createProject.create([
          [
            node('node'),
            relation('out', '', 'marketingLocation', {
              active: true,
              createdAt,
            }),
            node('marketingLocation'),
          ],
        ]);
      }
      // TODO: default to add ConfigService.defaultOrg
      createProject.create([
        [
          node('node'),
          relation('out', '', 'owningOrganization', {
            active: true,
            createdAt,
          }),
          node('organization'),
        ],
      ]);

      createProject.return('node.id as id').asResult<{ id: ID }>();
      const result = await createProject.first();

      if (!result) {
        throw new ServerException('failed to create a project');
      }

      // get the creating user's roles. Assign them on this project.
      // I'm going direct for performance reasons

      const roles = await this.repo.getRoles(session);

      if (!this.config.migration) {
        // Add creator to the project team if not in migration
        await this.projectMembers.create(
          {
            userId: session.userId,
            projectId: result.id,
            roles: [roles?.roles],
          },
          session
        );
      }

      await this.authorizationService.processNewBaseNode(
        IProject,
        result.id,
        session.userId
      );

      const project = await this.readOneUnsecured(result.id, session);

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
    sessionOrUserId: Session | ID
  ): Promise<UnsecuredDto<Project>> {
    const userId = isIdLike(sessionOrUserId)
      ? sessionOrUserId
      : sessionOrUserId.userId;
    const result = await this.repo.readOneUnsecured(id, userId);
    if (!result) {
      throw new NotFoundException('Could not find project');
    }

    const props = parsePropList(result.propList);
    return {
      ...parseBaseNodeProperties(result.node),
      // @ts-expect-error this could be missing from props for all projects created/updated before this property was added
      financialReportPeriod: ReportPeriod.Monthly,
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

  async readOne(id: ID, sessionOrUserId: Session | ID): Promise<Project> {
    const unsecured = await this.readOneUnsecured(id, sessionOrUserId);
    return await this.secure(unsecured, sessionOrUserId);
  }

  async update(
    input: UpdateProject,
    session: Session
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
      await this.projectRules.verifyStepChange(input.id, session, changes.step);
    }

    const {
      primaryLocationId,
      marketingLocationId,
      fieldRegionId,
      ...simpleChanges
    } = changes;

    let result = await this.repo.updateProperties(
      currentProject,
      simpleChanges
    );

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
    session: Session
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
      session
    );

    const permission = await this.repo.getEngagementPermission(
      session,
      project.id
    );

    return {
      ...result,
      canRead: !!permission?.canReadEngagementRead,
      canCreate:
        !!permission?.canReadEngagementCreate &&
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

    const permission = await this.repo.getTeamMemberPermission(
      session,
      projectId
    );

    return {
      ...result,
      canRead: !!permission?.canReadTeamMemberRead,
      canCreate: !!permission?.canReadTeamMemberCreate,
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

    const permission = await this.repo.getPartnershipPermission(
      session,
      projectId
    );

    return {
      ...result,
      canRead: !!permission?.canReadPartnershipRead,
      canCreate: !!permission?.canReadPartnershipCreate,
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

  async listProjectsWithDateRange() {
    return await this.repo.listProjectsWithDateRange();
  }

  protected async validateOtherResourceId(
    ids: Many<string>,
    label: string,
    resourceField: string,
    errMsg: string
  ): Promise<void> {
    let index = 0;
    for (const id of many(ids)) {
      const result = await this.repo.validateOtherResourceId(id, label);

      if (!result) {
        throw new NotFoundException(
          errMsg,
          `project.${resourceField}${Array.isArray(ids) ? `[${index}]` : ''}`
        );
      }
      index++;
    }
  }
}
