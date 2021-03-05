import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  getHighestSensitivity,
  InputException,
  NotFoundException,
  Sensitivity,
  ServerException,
  Session,
  UnauthorizedException,
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
  collect,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Role, rolesForScope, ScopedRole } from '../authorization/dto';
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
import {
  CreateProject,
  InternshipProject,
  IProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
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
import { DbProject } from './model';
import {
  ProjectMemberListInput,
  ProjectMemberService,
  SecuredProjectMemberList,
} from './project-member';
import { ProjectRules } from './project.rules';
import { projectListFilter } from './query.helpers';

@Injectable()
export class ProjectService {
  private readonly securedProperties = {
    name: true,
    departmentId: true,
    step: true,
    mouStart: true,
    mouEnd: true,
    initialMouEnd: true,
    stepChangedAt: true,
    estimatedSubmission: true,
    type: true,
    tags: true,
    financialReportReceivedAt: true,
    primaryLocation: true,
    marketingLocation: true,
    fieldRegion: true,
    owningOrganization: true,
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
    private readonly partnerService: PartnerService,
    private readonly config: ConfigService,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly projectRules: ProjectRules,
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
  ): Promise<Project> {
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
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    try {
      const createProject = this.db.query().call(matchRequestingUser, session);

      if (fieldRegionId) {
        createProject.match([
          node('fieldRegion', 'FieldRegion', { id: fieldRegionId }),
        ]);
      }
      if (primaryLocationId) {
        createProject.match([
          node('primaryLocation', 'Location', { id: primaryLocationId }),
        ]);
      }
      if (otherLocationIds?.length) {
        otherLocationIds.forEach((id) => {
          createProject.match([node(`otherLocation${id}`, 'Location', { id })]);
        });
      }
      if (marketingLocationId) {
        createProject.match([
          node('marketingLocation', 'Location', { id: marketingLocationId }),
        ]);
      }
      createProject.match([
        node('organization', 'Organization', { id: this.config.defaultOrg.id }),
      ]);

      createProject.call(
        createBaseNode,
        await generateId(),
        `Project:${input.type}Project`,
        secureProps,
        {
          type: createInput.type,
        }
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

      createProject.return('node.id as id').asResult<{ id: string }>();
      const result = await createProject.first();

      if (!result) {
        throw new ServerException('failed to create a project');
      }

      // get the creating user's roles. Assign them on this project.
      // I'm going direct for performance reasons
      const roles = await this.db
        .query()
        .match([
          node('user', 'User', { id: session.userId }),
          relation('out', '', 'roles', { active: true }),
          node('roles', 'Property'),
        ])
        .raw('RETURN roles.value as roles')
        .first();

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

      const dbProject = new DbProject();
      await this.authorizationService.processNewBaseNode(
        dbProject,
        result.id,
        session.userId
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
      throw new ServerException(`Could not create project`, e);
    }
  }

  async readOneTranslation(
    id: string,
    session: Session
  ): Promise<TranslationProject> {
    const project = await this.readOne(id, session);
    if (project.type !== ProjectType.Translation) {
      throw new Error('Project is not a translation project');
    }
    return project as TranslationProject;
  }

  async readOneInternship(
    id: string,
    session: Session
  ): Promise<InternshipProject> {
    const project = await this.readOne(id, session);
    if (project.type !== ProjectType.Internship) {
      throw new Error('Project is not an internship project');
    }
    return project as InternshipProject;
  }

  async readOne(
    id: string,
    sessionOrUserId: Session | string
  ): Promise<Project> {
    const userId =
      typeof sessionOrUserId === 'string'
        ? sessionOrUserId
        : sessionOrUserId.userId;
    const query = this.db
      .query()
      .match([node('node', 'Project', { id })])
      .call(matchPropList)
      .with(['node', 'propList'])
      .optionalMatch([
        [node('user', 'User', { id: userId })],
        [node('projectMember'), relation('out', '', 'user'), node('user')],
        [node('projectMember'), relation('in', '', 'member'), node('node')],
        [
          node('projectMember'),
          relation('out', '', 'roles', { active: true }),
          node('props', 'Property'),
        ],
      ])
      .with([collect('props.value', 'memberRoles'), 'propList', 'node'])
      .optionalMatch([
        node('node'),
        relation('out', '', 'primaryLocation', { active: true }),
        node('primaryLocation', 'Location'),
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
        relation('out', '', 'owningOrganization', { active: true }),
        node('organization', 'Organization'),
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
        'node',
        'memberRoles',
        'primaryLocation.id as primaryLocationId',
        'marketingLocation.id as marketingLocationId',
        'fieldRegion.id as fieldRegionId',
        'organization.id as owningOrganizationId',
        'collect(distinct sensitivity.value) as languageSensitivityList',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<Project>> & {
          primaryLocationId: string;
          memberRoles: Role[][];
          marketingLocationId: string;
          fieldRegionId: string;
          owningOrganizationId: string;
          languageSensitivityList: Sensitivity[];
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find Project');
    }
    const props = parsePropList(result.propList);
    const membershipRoles = result.memberRoles
      .flat()
      .map(rolesForScope('project'));
    const securedProps = await this.authorizationService.secureProperties(
      IProject,
      props,
      sessionOrUserId,
      membershipRoles
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      // Sensitivity is calculated based on the highest language sensitivity (for Translation Projects).
      // If project has no language engagements (new Translation projects and all Internship projects),
      // then falls back to the sensitivity prop which defaulted to High on create for all projects.
      sensitivity:
        getHighestSensitivity(result.languageSensitivityList) ||
        props.sensitivity,
      type: (result as any)?.node?.properties?.type,
      status: props.status,
      modifiedAt: props.modifiedAt,
      tags: {
        ...securedProps.tags,
        value: securedProps.tags.value ?? [],
      },
      primaryLocation: {
        ...securedProps.primaryLocation,
        value: result.primaryLocationId,
      },
      marketingLocation: {
        ...securedProps.marketingLocation,
        value: result.marketingLocationId,
      },
      fieldRegion: {
        ...securedProps.fieldRegion,
        value: result.fieldRegionId,
      },
      owningOrganization: {
        ...securedProps.owningOrganization,
        value: result.owningOrganizationId,
      },
      canDelete: await this.db.checkDeletePermission(id, sessionOrUserId),
      scope: membershipRoles,
    };
  }

  async update(input: UpdateProject, session: Session): Promise<Project> {
    const currentProject = await this.readOne(input.id, session);
    if (input.sensitivity && currentProject.type === ProjectType.Translation)
      throw new InputException(
        'Cannot update sensitivity on Translation Project',
        'project.sensitivity'
      );

    if (input.step) {
      await this.projectRules.verifyStepChange(input.id, session, input.step);
    }

    const changes = {
      ...input,
      modifiedAt: DateTime.local(),
      ...(input.step ? { status: stepToStatus(input.step) } : {}),
    };

    // TODO: re-connect the locationId node when locations are hooked up

    if (input.primaryLocationId) {
      const location = await this.locationService.readOne(
        input.primaryLocationId,
        session
      );

      if (!location.fundingAccount.value)
        throw new InputException(
          'Cannot connect location without a funding account',
          'project.primaryLocationId'
        );

      const createdAt = DateTime.local();
      const query = this.db
        .query()
        .match([
          node('user', 'User', { id: session.userId }),
          relation('in', 'memberOfSecurityGroup', 'member'),
          node('security', 'SecurityGroup'),
          relation('out', 'sgPerms', 'permission'),
          node('', 'Permission', {
            property: 'primaryLocation',
            edit: true,
          }),
          relation('out', 'permsOfBaseNode', 'baseNode'),
          node('project', 'Project', { id: input.id }),
        ])
        .with('project')
        .limit(1)
        .match([node('location', 'Location', { id: input.primaryLocationId })])
        .optionalMatch([
          node('project'),
          relation('out', 'oldRel', 'primaryLocation', { active: true }),
          node(''),
        ])
        .setValues({ 'oldRel.active': false })
        .with('project, location')
        .limit(1)
        .create([
          node('project'),
          relation('out', '', 'primaryLocation', {
            active: true,
            createdAt,
          }),
          node('location'),
        ]);

      await query.run();
    }

    if (input.fieldRegionId) {
      const createdAt = DateTime.local();
      const query = this.db
        .query()
        .match([
          node('user', 'User', { id: session.userId }),
          relation('in', 'memberOfSecurityGroup', 'member'),
          node('security', 'SecurityGroup'),
          relation('out', 'sgPerms', 'permission'),
          node('', 'Permission', {
            property: 'fieldRegion',
            edit: true,
          }),
          relation('out', 'permsOfBaseNode', 'baseNode'),
          node('project', 'Project', { id: input.id }),
        ])
        .with('project')
        .limit(1)
        .match([node('region', 'FieldRegion', { id: input.fieldRegionId })])
        .optionalMatch([
          node('project'),
          relation('out', 'oldRel', 'fieldRegion', { active: true }),
          node(''),
        ])
        .setValues({ 'oldRel.active': false })
        .with('project, region')
        .limit(1)
        .create([
          node('project'),
          relation('out', '', 'fieldRegion', {
            active: true,
            createdAt,
          }),
          node('region'),
        ]);

      await query.run();
    }

    const result = await this.db.sgUpdateProperties({
      session,
      object: currentProject,
      props: [
        'name',
        'mouStart',
        'mouEnd',
        'initialMouEnd',
        'estimatedSubmission',
        'status',
        'modifiedAt',
        'step',
        'sensitivity',
        'tags',
        'financialReportReceivedAt',
      ],
      changes,
      nodevar: 'project',
    });

    const event = new ProjectUpdatedEvent(
      result,
      currentProject,
      input,
      session
    );
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    if (!object) {
      throw new NotFoundException('Could not find project');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Project'
      );

    try {
      await this.db.deleteNodeNew({
        object,
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
    session: Session
  ): Promise<ProjectListOutput> {
    const label = `${filter.type ?? ''}Project`;
    const projectSortMap: Partial<Record<typeof input.sort, string>> = {
      name: 'toLower(prop.sortValue)',
      sensitivity: 'sensitivityValue',
    };

    // Subquery to get the sensitivity value for a Translation Project.
    // Get the highest sensitivity of the connected Language Engagement's Language
    // If an Engagement doesn't exist, then default to 3 (high)
    const sensitivitySubquery = `call {
      with node
      optional match (node)-[:engagement { active: true }]->(:LanguageEngagement)-[:language { active: true }]->
      (:Language)-[:sensitivity { active: true }]->(sensitivityProp:Property)
      WITH *, case sensitivityProp.value
        when null then 3
        when 'High' then 3
        when 'Medium' then 2
        when 'Low' then 1
        end as langSensitivityVal
      ORDER BY langSensitivityVal desc
      limit 1
      return langSensitivityVal
      }`;

    // In the first case, if the node is a translation project, use the langSensitivityVal from above.
    // Else use the sensitivity prop value
    const sensitivityCase = `case
      when 'TranslationProject' in labels(node) then langSensitivityVal
      when prop.value = 'High' then 3
      when prop.value = 'Medium' then 2
      when prop.value = 'Low' then 1
      end as sensitivityValue`;

    const sortBy = projectSortMap[input.sort] ?? 'prop.value';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .with('distinct(node) as node, requestingUser')
      .call(projectListFilter, filter)
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        (q, sort, order) =>
          q
            .raw(input.sort === 'sensitivity' ? sensitivitySubquery : '')
            .match([
              node('node'),
              relation('out', '', sort, { active: true }),
              node('prop', 'Property'),
            ])
            .with([
              '*',
              ...(input.sort === 'sensitivity' ? [sensitivityCase] : []),
            ])
            .orderBy(sortBy, order)
      );

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

    const permission = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfReadSecurityGroup', 'member'),
          node('readSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgReadPerms', 'permission'),
          node('canReadEngagement', 'Permission', {
            property: 'engagement',
            read: true,
          }),
          relation('out', 'readPermsOfBaseNode', 'baseNode'),
          node('project', 'Project', { id: project.id }),
        ],
      ])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfEditSecurityGroup', 'member'),
          node('editSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgEditPerms', 'permission'),
          node('canEditEngagement', 'Permission', {
            property: 'engagement',
            edit: true,
          }),
          relation('out', 'editPermsOfBaseNode', 'baseNode'),
          node('project'),
        ],
      ])
      .return({
        canReadEngagement: [
          {
            read: 'canReadEngagementRead',
          },
        ],
        canEditEngagement: [
          {
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

    const permission = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfReadSecurityGroup', 'member'),
          node('readSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgReadPerms', 'permission'),
          node('canReadTeamMember', 'Permission', {
            property: 'member',
            read: true,
          }),
          relation('out', 'readPermsOfBaseNode', 'baseNode'),
          node('project', 'Project', { id: projectId }),
        ],
      ])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfEditSecurityGroup', 'member'),
          node('editSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgEditPerms', 'permission'),
          node('canEditTeamMember', 'Permission', {
            property: 'member',
            edit: true,
          }),
          relation('out', 'editPermsOfBaseNode', 'baseNode'),
          node('project'),
        ],
      ])
      .return({
        canReadTeamMember: [
          {
            read: 'canReadTeamMemberRead',
          },
        ],
        canEditTeamMember: [
          {
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

    const permission = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfReadSecurityGroup', 'member'),
          node('readSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgReadPerms', 'permission'),
          node('canReadPartnership', 'Permission', {
            property: 'partnership',
            read: true,
          }),
          relation('out', 'readPermsOfBaseNode', 'baseNode'),
          node('project', 'Project', { id: projectId }),
        ],
      ])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfEditSecurityGroup', 'member'),
          node('editSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgEditPerms', 'permission'),
          node('canEditPartnership', 'Permission', {
            property: 'partnership',
            edit: true,
          }),
          relation('out', 'editPermsOfBaseNode', 'baseNode'),
          node('project'),
        ],
      ])
      .return({
        canReadPartnership: [
          {
            read: 'canReadPartnershipRead',
          },
        ],
        canEditPartnership: [
          {
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

  async addOtherLocation(
    projectId: string,
    locationId: string,
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
    projectId: string,
    locationId: string,
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
    projectId: string,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationsFromNode(
      'Project',
      projectId,
      'otherLocations',
      input,
      session
    );
  }

  async currentBudget(
    projectOrProjectId: Project | string,
    session: Session
  ): Promise<SecuredBudget> {
    const projectId =
      typeof projectOrProjectId === 'string'
        ? projectOrProjectId
        : projectOrProjectId.id;
    const budgets = await this.budgetService.list(
      {
        filter: {
          projectId: projectId,
        },
      },
      session
    );

    const current = budgets.items.find(
      (b) => b.status === BudgetStatus.Current
    );

    // #574 - if no current budget, then fallback to the first pending budget
    const budgetToReturn = current ?? budgets.items[0];

    const membershipRoles = await this.getMembershipRoles(projectId, session);
    const permsOfProject = await this.authorizationService.getPermissions(
      IProject,
      session,
      membershipRoles
    );

    return {
      value: budgetToReturn,
      canRead: permsOfProject.budget.canRead,
      canEdit: permsOfProject.budget.canEdit,
    };
  }

  private async getMembershipRoles(
    projectId: string | Project,
    session: Session
  ): Promise<ScopedRole[]> {
    if (typeof projectId !== 'string') {
      return projectId.scope;
    }

    const query = this.db
      .query()
      .match([
        node('node', 'Project', { projectId }),
        relation('out', '', 'member', { active: true }),
        node('projectMember', 'ProjectMember'),
        relation('out', '', 'user', { active: true }),
        node('user', 'User', { id: session.userId }),
      ])
      .match([
        node('projectMember'),
        relation('out', 'r', 'roles', { active: true }),
        node('roles', 'Property'),
      ])
      .return('collect(roles.value) as memberRoles')
      .asResult<{
        memberRoles: Role[][];
      }>();
    const result = await query.first();
    return result?.memberRoles.flat().map(rolesForScope('project')) ?? [];
  }

  async getRootDirectory(
    projectId: string,
    session: Session
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

  async consistencyChecker(session: Session): Promise<boolean> {
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
