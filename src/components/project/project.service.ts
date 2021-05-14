import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Node, node, relation, Relation } from 'cypher-query-builder';
import { Many } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
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
  BaseNode,
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  PropListDbResult,
  runListQuery,
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
      const createProject = this.db.query().apply(matchRequestingUser(session));

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
    const query = this.db
      .query()
      .match([node('node', 'Project', { id })])
      .apply(matchPropList)
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
        node('requestingUser', 'User', { id: userId }),
        relation('out', 'pinnedRel', 'pinned'),
        node('node'),
      ])
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
        'pinnedRel',
        'primaryLocation.id as primaryLocationId',
        'marketingLocation.id as marketingLocationId',
        'fieldRegion.id as fieldRegionId',
        'organization.id as owningOrganizationId',
        'collect(distinct sensitivity.value) as languageSensitivityList',
      ])
      .asResult<{
        node: Node<BaseNode & { type: ProjectType }>;
        propList: PropListDbResult<DbPropsOfDto<Project>>;
        pinnedRel?: Relation;
        primaryLocationId: ID;
        memberRoles: Role[][];
        marketingLocationId: ID;
        fieldRegionId: ID;
        owningOrganizationId: ID;
        languageSensitivityList: Sensitivity[];
      }>();

    const result = await query.first();
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
    const securedProps = await this.authorizationService.secureProperties({
      resource: IProject,
      props: project,
      sessionOrUserId,
      otherRoles: project.scope,
    });

    return {
      ...project,
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(
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

    const changes = this.db.getActualChanges(IProject, currentProject, {
      ...input,
      ...(input.step ? { status: stepToStatus(input.step) } : {}),
    });

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

    let result = await this.db.updateProperties({
      type:
        currentProject.type === ProjectType.Translation
          ? TranslationProject
          : InternshipProject,
      object: currentProject,
      changes: simpleChanges,
    });

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
      const query = this.db
        .query()
        .match(node('project', 'Project', { id: input.id }))
        .match(node('location', 'Location', { id: input.primaryLocationId }))
        .with('project, location')
        .limit(1)
        .optionalMatch([
          node('project', 'Project', { id: input.id }),
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
      const query = this.db
        .query()
        .match(node('project', 'Project', { id: input.id }))
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

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Project'
      );

    try {
      await this.db.deleteNode(object);
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
      .apply(projectListFilter(filter))
      .apply(
        calculateTotalAndPaginateList(IProject, input, (q) =>
          ['id', 'createdAt'].includes(input.sort)
            ? q.with('*').orderBy(`node.${input.sort}`, input.order)
            : q
                .raw(input.sort === 'sensitivity' ? sensitivitySubquery : '')
                .match([
                  node('node'),
                  relation('out', '', input.sort, { active: true }),
                  node('prop', 'Property'),
                ])
                .with([
                  '*',
                  ...(input.sort === 'sensitivity' ? [sensitivityCase] : []),
                ])
                .orderBy(sortBy, input.order)
        )
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
    projectId: ID,
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
    projectOrProjectId: Project | ID,
    session: Session
  ): Promise<SecuredBudget> {
    const projectId = isIdLike(projectOrProjectId)
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
    const permsOfProject = await this.authorizationService.getPermissions({
      resource: IProject,
      sessionOrUserId: session,
      otherRoles: membershipRoles,
    });

    return {
      value: budgetToReturn,
      canRead: permsOfProject.budget.canRead,
      canEdit: session.roles.includes('global:Administrator')
        ? true
        : permsOfProject.budget.canEdit &&
          budgetToReturn.status === BudgetStatus.Pending,
    };
  }

  private async getMembershipRoles(
    projectId: ID | Project,
    session: Session
  ): Promise<ScopedRole[]> {
    if (!isIdLike(projectId)) {
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
    projectId: ID,
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

  async listProjectsWithDateRange() {
    const result = await this.db
      .query()
      .match(node('project', 'Project'))
      .match([
        node('project'),
        relation('out', '', 'mouStart', { active: true }),
        node('mouStart', 'Property'),
      ])
      .match([
        node('project'),
        relation('out', '', 'mouEnd', { active: true }),
        node('mouEnd', 'Property'),
      ])
      .raw('WHERE mouStart.value IS NOT NULL AND mouEnd.value IS NOT NULL')
      .return(
        'project.id as projectId, mouStart.value as mouStart, mouEnd.value as mouEnd'
      )
      .asResult<{
        projectId: ID;
        mouStart: CalendarDate;
        mouEnd: CalendarDate;
      }>()
      .run();

    return result;
  }

  protected async validateOtherResourceId(
    ids: Many<string>,
    label: string,
    resourceField: string,
    errMsg: string
  ): Promise<void> {
    let index = 0;
    for (const id of many(ids)) {
      const result = await this.db
        .query()
        .match([node('node', label, { id })])
        .return('node')
        .first();

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
