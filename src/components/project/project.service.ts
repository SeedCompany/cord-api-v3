import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { contains, node, relation } from 'cypher-query-builder';
import { find, flatMap, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  fiscalYears,
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
import { Budget, BudgetService, BudgetStatus, SecuredBudget } from '../budget';
import {
  EngagementListInput,
  EngagementService,
  SecuredEngagementList,
} from '../engagement';
import { FileService, SecuredDirectory } from '../file';
import { LocationService } from '../location';
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
  ProjectMemberListInput,
  ProjectMemberService,
  Role,
  SecuredProjectMemberList,
} from './project-member';

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
    private readonly config: ConfigService,
    private readonly eventBus: IEventBus,
    @Logger('project:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Project) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:step]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:step]-() ASSERT EXISTS(r.createdAt)',
      'CREATE CONSTRAINT ON (n:ProjectStep) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:ProjectStep) ASSERT EXISTS(n.value)',

      'CREATE CONSTRAINT ON ()-[r:status]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:status]-() ASSERT EXISTS(r.createdAt)',
      'CREATE CONSTRAINT ON (n:ProjectStatus) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:ProjectStatus) ASSERT EXISTS(n.value)',

      'CREATE CONSTRAINT ON (n:ProjectName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:ProjectName) ASSERT n.value IS UNIQUE',
    ];
  }

  // helper method for defining properties
  property = (prop: string, value: any | null) => {
    const createdAt = DateTime.local();
    return [
      [
        node('newProject'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string, canEdit = false) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newProject'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: canEdit,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('node'),
      ],
    ];
  };

  propMatch = (property: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('project'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async create(
    { locationId, ...input }: CreateProject,
    session: ISession
  ): Promise<Project> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }

    const createdAt = DateTime.local();
    const step = input.step ?? ProjectStep.EarlyConversations;
    const createInput = {
      sensitivity: Sensitivity.High, // TODO: this needs to be calculated based on language engagement
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
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProjectName',
      },
      {
        key: 'sensitivity',
        value: createInput.sensitivity,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'step',
        value: createInput.step,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProjectStep',
      },
      {
        key: 'status',
        value: createInput.status,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProjectStatus',
      },
      {
        key: 'mouStart',
        value: createInput.mouStart,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouEnd',
        value: createInput.mouEnd,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'estimatedSubmission',
        value: createInput.estimatedSubmission,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'modifiedAt',
        value: createInput.modifiedAt,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    try {
      const createProject = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ]);
      if (locationId) {
        createProject.match([
          node('country', 'Country', { active: true, id: locationId }),
        ]);
      }

      createProject
        .call(
          createBaseNode,
          `Project:${input.type}Project`,
          secureProps,
          {
            owningOrgId: session.owningOrgId,
            type: createInput.type,
          },
          canEdit ? ['name', 'mouStart', 'mouEnd'] : []
        )
        .create([
          ...this.permission('engagement'),
          ...this.permission('teamMember'),
          ...this.permission('partnership'),
          ...this.permission('location'),
        ]);
      if (locationId) {
        createProject.create([
          [
            node('country'),
            relation('in', '', 'location', { active: true, createdAt }),
            node('node'),
          ],
        ]);
      }
      createProject.return('node.id as id');
      const result = await createProject.first();

      if (!result) {
        throw new ServerException('failed to create a project');
      }
      let location;
      if (locationId) {
        location = await this.db
          .query()
          .match([node('country', 'Country', { active: true, id: locationId })])
          .return('country.id')
          .first();
      }

      if (!result) {
        if (locationId && !location) {
          throw new InputException(
            'Could not find location',
            'project.locationId'
          );
        }
      }

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
      .match([node('node', 'Project', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .optionalMatch([
        node('node'),
        relation('out', '', 'location'),
        node('country', 'Country', { active: true }),
      ])
      .return('propList, permList, node, country.id as countryId')
      .asResult<
        StandardReadResult<DbPropsOfDto<Project>> & {
          countryId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find Project');
    }

    const location = result?.countryId
      ? await this.locationService
          .readOneCountry(result?.countryId, session)
          .then((country) => {
            return {
              value: {
                id: country.id,
                name: { ...country.name },
                region: { ...country.region },
                createdAt: country.createdAt,
              },
            };
          })
          .catch(() => {
            return {
              value: undefined,
            };
          })
      : {
          value: undefined,
        };

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(props, result.permList, {
      name: true,
      departmentId: true,
      step: true,
      mouStart: true,
      mouEnd: true,
      estimatedSubmission: true,
      type: true,
    });

    const locationPerms: any = find(
      result.permList,
      (item) => (item as any).properties.property === 'location'
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      sensitivity: props.sensitivity,
      type: (result as any)?.node?.properties?.type,
      status: props.status,
      modifiedAt: props.modifiedAt,
      location: {
        ...location,
        canRead: !!locationPerms?.properties?.read,
        canEdit: !!locationPerms?.properties?.edit,
      },
    };
  }

  async update(input: UpdateProject, session: ISession): Promise<Project> {
    const object = await this.readOne(input.id, session);

    const changes = {
      ...input,
      modifiedAt: DateTime.local(),
      ...(input.step ? { status: stepToStatus(input.step) } : {}),
    };

    // TODO: re-connect the locationId node when locations are hooked up

    const result = await this.db.sgUpdateProperties({
      session,
      object,
      props: [
        'name',
        'mouStart',
        'mouEnd',
        'estimatedSubmission',
        'status',
        'modifiedAt',
        'step',
      ],
      changes,
      nodevar: 'project',
    });

    await this.eventBus.publish(
      new ProjectUpdatedEvent(result, object, input, session)
    );

    return result;
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
    const label =
      filter.type === 'Internship'
        ? 'InternshipProject'
        : filter.type === 'Translation'
        ? 'TranslationProject'
        : 'Project';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.name
          ? [
              relation('out', '', 'name', { active: true }),
              node('name', 'Property', { active: true }),
            ]
          : []),
      ])
      .call((q) =>
        filter.name ? q.where({ name: { value: contains(filter.name) } }) : q
      )
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        q
          .match([
            node('node'),
            relation('out', '', sort),
            node('prop', 'Property', { active: true }),
          ])
          .with('*')
          .orderBy('prop.value', order)
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
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canReadEngagement', 'Permission', {
            property: 'engagement',
            active: true,
            read: true,
          }),
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
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canReadTeamMember', 'Permission', {
            property: 'teamMember',
            active: true,
            read: true,
          }),
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
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canReadPartnership', 'Permission', {
            property: 'partnership',
            active: true,
            read: true,
          }),
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
          node('project', 'Project', { active: true, id: projectId }),
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
      .match([
        matchSession(session),
        [
          node('project', 'Project', {
            active: true,
          }),
        ],
      ])
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
