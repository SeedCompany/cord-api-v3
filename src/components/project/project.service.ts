import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { flatMap } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  fiscalYears,
  getHighestSensitivity,
  InputException,
  ISession,
  NotFoundException,
  Sensitivity,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  IEventBus,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  OnIndex,
  Property,
  UniquenessError,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPermList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Budget, BudgetService, BudgetStatus, SecuredBudget } from '../budget';
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
import {
  PartnershipListInput,
  PartnershipService,
  PartnershipType,
  SecuredPartnershipList,
} from '../partnership';
import {
  CreateProject,
  InternshipProject,
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
  InternalRole,
  ProjectMemberListInput,
  ProjectMemberService,
  Role,
  SecuredProjectMemberList,
} from './project-member';
import { projectListFilter } from './query.helpers';

@Injectable()
export class ProjectService {
  private readonly securedProperties = {
    name: true,
    departmentId: true,
    step: true,
    mouStart: true,
    mouEnd: true,
    estimatedSubmission: true,
    type: true,
    primaryLocation: true,
    nonPrimaryLocation: true,
    marketingLocation: true,
    fieldRegion: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly projectMembers: ProjectMemberService,
    private readonly locationService: LocationService,
    @Inject(forwardRef(() => BudgetService))
    private readonly budgetService: BudgetService,
    @Inject(forwardRef(() => PartnershipService))
    private readonly partnerships: PartnershipService,
    private readonly fileService: FileService,
    @Inject(forwardRef(() => EngagementService))
    private readonly engagementService: EngagementService,
    private readonly config: ConfigService,
    private readonly eventBus: IEventBus,
    private readonly authorizationService: AuthorizationService,
    @Logger('project:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT n.id IS UNIQUE',
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
      nonPrimaryLocationId,
      marketingLocationId,
      fieldRegionId,
      ...input
    }: CreateProject,
    session: ISession
  ): Promise<Project> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }

    if (input.type === ProjectType.Translation && input.sensitivity) {
      throw new InputException(
        'Cannot set sensitivity on tranlation project',
        'project.sensitivity'
      );
    }

    const createdAt = DateTime.local();
    const step = input.step ?? ProjectStep.EarlyConversations;
    const createInput = {
      sensitivity: Sensitivity.High, // Default to high on create
      ...input,
      step,
      status: stepToStatus(step),
      modifiedAt: DateTime.local(),
    };
    const canEdit = createInput.status === ProjectStatus.InDevelopment;
    const secureProps: Property[] = [
      {
        key: 'name',
        value: createInput.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProjectName',
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
    ];
    try {
      const createProject = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([node('fieldRegion', 'FieldRegion', { id: fieldRegionId })]);

      if (primaryLocationId) {
        createProject.match([
          node('primaryLocation', 'Location', { id: primaryLocationId }),
        ]);
      }
      if (nonPrimaryLocationId) {
        createProject.match([
          node('nonPrimaryLocation', 'Location', { id: nonPrimaryLocationId }),
        ]);
      }
      if (marketingLocationId) {
        createProject.match([
          node('marketingLocation', 'Location', { id: marketingLocationId }),
        ]);
      }

      createProject
        .call(
          createBaseNode,
          `Project:${input.type}Project`,
          secureProps,
          {
            type: createInput.type,
          },
          canEdit ? ['name', 'mouStart', 'mouEnd'] : []
        )
        .create([
          [
            node('node'),
            relation('out', '', 'fieldRegion', { active: true, createdAt }),
            node('fieldRegion'),
          ],
        ]);
      if (primaryLocationId) {
        createProject.create([
          [
            node('node'),
            relation('out', '', 'primaryLocation', { active: true, createdAt }),
            node('primaryLocation'),
          ],
        ]);
      }
      if (nonPrimaryLocationId) {
        createProject.create([
          [
            node('node'),
            relation('out', '', 'nonPrimaryLocation', {
              active: true,
              createdAt,
            }),
            node('nonPrimaryLocation'),
          ],
        ]);
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

      createProject.return('node.id as id').asResult<{ id: string }>();
      const result = await createProject.first();

      if (!result) {
        throw new ServerException('failed to create a project');
      }

      await this.authorizationService.addPermsForRole(
        InternalRole.Admin,
        'Project',
        result.id,
        session.userId
      );

      await this.projectMembers.create(
        {
          userId: session.userId,
          projectId: result.id,
          roles: [Role.ProjectManager],
        },
        session
      );

      const project = await this.readOne(result.id, session);

      await this.eventBus.publish(new ProjectCreatedEvent(project, session));

      return project;
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'ProjectName') {
        throw new DuplicateException(
          'project.name',
          'Project with this name already exists'
        );
      }
      this.logger.warning(`Could not create project`, {
        exception: e,
      });
      throw new ServerException(`Could not create project`, e);
    }
  }

  async readOneTranslation(
    id: string,
    session: ISession
  ): Promise<TranslationProject> {
    const project = await this.readOne(id, session);
    if (project.type !== ProjectType.Translation) {
      throw new Error('Project is not a translation project');
    }
    return project as TranslationProject;
  }

  async readOneInternship(
    id: string,
    session: ISession
  ): Promise<InternshipProject> {
    const project = await this.readOne(id, session);
    if (project.type !== ProjectType.Internship) {
      throw new Error('Project is not an internship project');
    }
    return project as InternshipProject;
  }

  async readOne(id: string, session: ISession): Promise<Project> {
    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Project', { id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'primaryLocation', { active: true }),
        node('primaryLocation', 'Location'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'nonPrimaryLocation', { active: true }),
        node('nonPrimaryLocation', 'Location'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'marketingLocation', { active: true }),
        node('marketingLocation', 'Location'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'fieldRegion', { active: true }),
        node('fieldRegion', 'FieldRegion'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'LanguageEngagement'),
        relation('out', '', 'language', { active: true }),
        node('', 'Language'),
        relation('out', '', 'sensitivity', { active: true }),
        node('sensitivity', 'Property'),
      ])
      .return([
        'propList',
        'permList',
        'node',
        'primaryLocation.id as primaryLocationId',
        'nonPrimaryLocation.id as nonPrimaryLocationId',
        'marketingLocation.id as marketingLocationId',
        'fieldRegion.id as fieldRegionId',
        'collect(distinct sensitivity.value) as languageSensitivityList',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<Project>> & {
          primaryLocationId: string;
          nonPrimaryLocationId: string;
          marketingLocationId: string;
          fieldRegionId: string;
          languageSensitivityList: Sensitivity[];
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find Project');
    }

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(
      props,
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      // Sensitivity is calulated based on the highest language sensitivity (for Translation Projects).
      // If project has no langauge engagements (new Translation projects and all Internship projects),
      // then falls back to the sensitivity prop which defaulted to High on create for all projects.
      sensitivity:
        getHighestSensitivity(result.languageSensitivityList) ||
        props.sensitivity,
      type: (result as any)?.node?.properties?.type,
      status: props.status,
      modifiedAt: props.modifiedAt,
      primaryLocation: {
        ...securedProps.primaryLocation,
        value: result.primaryLocationId,
      },
      nonPrimaryLocation: {
        ...securedProps.nonPrimaryLocation,
        value: result.nonPrimaryLocationId,
      },
      marketingLocation: {
        ...securedProps.marketingLocation,
        value: result.marketingLocationId,
      },
      fieldRegion: {
        ...securedProps.fieldRegion,
        value: result.fieldRegionId,
      },
    };
  }

  async update(input: UpdateProject, session: ISession): Promise<Project> {
    const currentProject = await this.readOne(input.id, session);

    if (input.sensitivity && currentProject.type === ProjectType.Translation)
      throw new InputException(
        'Cannot update sensitivity on Translation Project',
        'project.sensitivity'
      );

    const changes = {
      ...input,
      modifiedAt: DateTime.local(),
      ...(input.step ? { status: stepToStatus(input.step) } : {}),
    };

    // TODO: re-connect the locationId node when locations are hooked up

    const result = await this.db.sgUpdateProperties({
      session,
      object: currentProject,
      props: [
        'name',
        'mouStart',
        'mouEnd',
        'estimatedSubmission',
        'status',
        'modifiedAt',
        'step',
        'sensitivity',
      ],
      changes,
      nodevar: 'project',
    });

    await this.eventBus.publish(
      new ProjectUpdatedEvent(result, currentProject, input, session)
    );

    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find project');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canCreateProject',
      });
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
    session: ISession
  ): Promise<ProjectListOutput> {
    const label = `${filter.type ?? ''}Project`;
    const projectSortMap: Partial<Record<typeof input.sort, string>> = {
      name: 'lower(prop.value)',
    };
    const sortBy = projectSortMap[input.sort] ?? 'prop.value';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .with('distinct(node) as node')
      .call(projectListFilter, filter)
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        q
          .match([
            node('node'),
            relation('out', '', sort),
            node('prop', 'Property'),
          ])
          .with('*')
          .orderBy(sortBy, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listEngagements(
    project: Project,
    input: EngagementListInput,
    session: ISession
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

    const permission = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member'),
          node('', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node('canReadEngagement', 'Permission', {
            property: 'engagement',
          }),
          relation('out', '', 'baseNode'),
          node('project', 'Project', { id: project.id }),
        ],
      ])
      .return({
        canReadEngagement: [
          {
            read: 'canReadEngagementRead',
            edit: 'canReadEngagementCreate',
          },
        ],
      })
      .first();

    return {
      ...result,
      canRead: !!permission?.canReadEngagementRead,
      canCreate: !!permission?.canReadEngagementCreate,
    };
  }

  async listProjectMembers(
    projectId: string,
    input: ProjectMemberListInput,
    session: ISession
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

    const permission = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member'),
          node('', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node('canReadTeamMember', 'Permission', {
            property: 'member',
            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('project', 'Project', { id: projectId }),
        ],
      ])
      .return({
        canReadTeamMember: [
          {
            read: 'canReadTeamMemberRead',
            edit: 'canReadTeamMemberCreate',
          },
        ],
      })
      .first();

    return {
      ...result,
      canRead: !!permission?.canReadTeamMemberRead,
      canCreate: !!permission?.canReadTeamMemberCreate,
    };
  }

  async listPartnerships(
    projectId: string,
    input: PartnershipListInput,
    session: ISession
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

    const permission = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member'),
          node('', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node('canReadPartnership', 'Permission', {
            property: 'partnership',
            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('project', 'Project', { id: projectId }),
        ],
      ])
      .return({
        canReadPartnership: [
          {
            read: 'canReadPartnershipRead',
            edit: 'canReadPartnershipCreate',
          },
        ],
      })
      .first();

    return {
      ...result,
      canRead: !!permission?.canReadPartnershipRead,
      canCreate: !!permission?.canReadPartnershipCreate,
    };
  }

  async listNonPrimaryLocations(
    _projectId: string,
    _input: LocationListInput,
    _session: ISession
  ): Promise<SecuredLocationList> {
    // TODO
    return ([] as unknown) as SecuredLocationList;
  }

  async currentBudget(
    project: Project,
    session: ISession
  ): Promise<SecuredBudget> {
    const budgets = await this.budgetService.list(
      {
        filter: {
          projectId: project.id,
        },
      },
      session
    );

    const current = budgets.items.find(
      (b) => b.status === BudgetStatus.Current
    );

    //574 - if no current budget, then fallback to the first pending budget
    let pendingBudget;
    if (!current) {
      pendingBudget = budgets.items[0];
    }

    return {
      value: current ? current : pendingBudget,
      canEdit: true,
      canRead: true,
    };
  }

  async getRootDirectory(
    projectId: string,
    session: ISession
  ): Promise<SecuredDirectory> {
    const rootRef = await this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .optionalMatch([
        [
          node('project', 'Project', { id: projectId }),
          relation('out', 'rootDirectory', { active: true }),
          node('directory', 'BaseNode:Directory'),
        ],
      ])
      .return({
        directory: [{ id: 'id' }],
      })
      .first();

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

  async attachBudgetRecords(
    budget: Budget,
    project: Pick<Project, 'id' | 'mouStart' | 'mouEnd'>,
    session: ISession
  ) {
    const partners = await this.partnerships.list(
      {
        filter: { projectId: project.id },
      },
      session
    );
    const fundingOrgIds = partners.items
      .filter((p) => p.types.value.includes(PartnershipType.Funding))
      .map((p) => p.organization);

    // calculate the fiscalYears covered by this date range
    const fiscalRange = fiscalYears(
      project.mouStart.value,
      project.mouEnd.value
    );
    const inputRecords = flatMap(fiscalRange, (fiscalYear) =>
      fundingOrgIds.map((organizationId) => ({
        budgetId: budget.id,
        organizationId,
        fiscalYear,
      }))
    );
    return Promise.all(
      inputRecords.map((record) =>
        this.budgetService.createRecord(record, session)
      )
    );
  }

  async consistencyChecker(session: ISession): Promise<boolean> {
    const projects = await this.db
      .query()
      .match([matchSession(session), [node('project', 'Project')]])
      .return('project.id as id')
      .run();

    return (
      (
        await Promise.all(
          projects.map(async (project) => {
            return await this.db.isRelationshipUnique({
              session,
              id: project.id,
              relName: 'location',
              srcNodeLabel: 'Project',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          projects.map(async (project) => {
            return await this.db.hasProperties({
              session,
              id: project.id,
              // props: ['type', 'status', 'name', 'step'],
              props: ['status', 'name', 'step'],
              nodevar: 'Project',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
