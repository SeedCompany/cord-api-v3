import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { flatMap, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { fiscalYears, ISession, Sensitivity } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByChildBaseNodeCount,
  filterBySubarray,
  IEventBus,
  ILogger,
  listWithSecureObject,
  listWithUnsecureObject,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  OnIndex,
  Property,
  runListQuery,
} from '../../core';
import {
  Budget,
  BudgetService,
  BudgetStatus,
  SecuredBudget,
  UpdateBudget,
} from '../budget';
import {
  EngagementListInput,
  EngagementService,
  SecuredEngagementList,
} from '../engagement';
import { Directory, FileService } from '../file';
import { LocationService } from '../location';
import {
  PartnershipListInput,
  PartnershipService,
  PartnershipType,
  SecuredPartnershipList,
} from '../partnership';
import {
  CreateProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  ProjectStatus,
  ProjectStep,
  stepToStatus,
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
    private readonly engagementService: EngagementService,
    private readonly config: ConfigService,
    private readonly eventBus: IEventBus,
    @Logger('project:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
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
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
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
    const createdAt = DateTime.local().toString();
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
    const createdAt = DateTime.local();
    const createInput = {
      sensitivity: Sensitivity.High, // TODO: this needs to be calculated based on language engagement
      step: ProjectStep.EarlyConversations,
      status: stepToStatus(ProjectStep.EarlyConversations),
      modifiedAt: DateTime.local(),
      ...input,
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

      createProject.call(
        createBaseNode,
        `Project:${input.type}Project`,
        secureProps,
        {
          owningOrgId: session.owningOrgId,
          type: createInput.type,
        },
        canEdit ? ['name', 'mouStart', 'mouEnd'] : []
      );
      createProject.create([
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
          throw new ServerException('Could not find location');
        }
      }

      await this.projectMembers.create(
        {
          userId: session.userId!,
          projectId: result.id,
          roles: [Role.ProjectManager],
        },
        session
      );

      const project = await this.readOne(result.id, session);

      await this.eventBus.publish(new ProjectCreatedEvent(project, session));

      return project;
    } catch (e) {
      this.logger.warning(`Could not create project`, {
        exception: e,
      });
      throw new ServerException(
        `Could not create project ${e.name} ${e.value}`
      );
    }
  }

  async readOne(id: string, session: ISession): Promise<Project> {
    this.logger.info('query readone project', { id, userId: session.userId });
    const label = 'Project';
    const baseNodeMetaProps = ['id', 'createdAt', 'type'];
    const unsecureProps = ['status', 'sensitivity'];
    const secureProps = [
      'name',
      'deptId',
      'step',
      'mouStart',
      'mouEnd',
      'estimatedSubmission',
      'modifiedAt',
    ];
    const readProject = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label, id)
      .call(addAllSecureProperties, ...secureProps, ...unsecureProps)
      .optionalMatch([
        node('canReadLocation', 'Permission', {
          property: 'location',
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
        relation('out', '', 'location', { active: true }),
        node('country', 'Country', { active: true }),
      ])
      .return(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithUnsecureObject(unsecureProps)},
            ${listWithSecureObject(secureProps)},
            countryId: country.id,
            canReadLocationRead: canReadLocation.read,
            canReadLocationEdit: canReadLocation.edit
          } as project
        `
      );

    let result;
    try {
      result = await readProject.first();
    } catch (e) {
      this.logger.error('e :>> ', e);
      return await Promise.reject(e);
    }

    if (!result) {
      throw new NotFoundException(
        `Could not find project DEBUG: requestingUser ${session.userId} target ProjectId ${id}`
      );
    }

    const location = result.project.countryId
      ? await this.locationService
          .readOneCountry(result.project.countryId, session)
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

    return {
      id,
      createdAt: result.project.createdAt,
      modifiedAt: result.project.modifiedAt.value,
      type: result.project.type,
      sensitivity: result.project.sensitivity,
      name: result.project.name,
      deptId: result.project.deptId,
      step: result.project.step,
      status: result.project.status,
      location: {
        ...location,
        canRead: !!result.project.canReadLocationRead,
        canEdit: !!result.project.canReadLocationEdit,
      },
      mouStart: result.project.mouStart,
      mouEnd: result.project.mouEnd,
      estimatedSubmission: result.project.estimatedSubmission,
    };
  }

  async update(input: UpdateProject, session: ISession): Promise<Project> {
    const object = await this.readOne(input.id, session);

    const changes = {
      ...input,
      modifiedAt: DateTime.local(),
      status: object.step.value
        ? stepToStatus(object.step.value)
        : object.status,
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
      ],
      changes,
      nodevar: 'project',
    });

    await this.eventBus.publish(
      new ProjectUpdatedEvent(result, input, session)
    );

    const budgets = await this.budgetService.list(
      {
        filter: {
          projectId: input.id,
        },
      },
      session
    );

    const pendingBudget = budgets.items.find(
      (b) => b.status === BudgetStatus.Pending
    );
    //574 -The pending budget should be set to active i.e Current when the project gets set to active
    if (
      (changes.status.includes(ProjectStatus.InDevelopment) ||
        changes.status.includes(ProjectStatus.Pending)) &&
      pendingBudget?.status.includes(BudgetStatus.Pending)
    ) {
      const input: UpdateBudget = {
        id: pendingBudget.id,
        status: BudgetStatus.Current,
      };

      await this.budgetService.update(input, session);
    }

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
    const label = 'Project';
    const baseNodeMetaProps = ['id', 'createdAt', 'type'];
    const unsecureProps = ['status', 'sensitivity'];
    const secureProps = [
      'name',
      'deptId',
      'step',
      'location',
      'mouStart',
      'mouEnd',
      'estimatedSubmission',
      'modifiedAt',
    ];

    const listQuery = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);
    // filter by filter options
    if (filter.status) {
      listQuery.call(filterBySubarray, label, 'status', filter.status);
    }
    if (filter.sensitivity) {
      listQuery.call(
        filterBySubarray,
        label,
        'sensitivity',
        filter.sensitivity
      );
    }
    if (filter.clusters) {
      listQuery.call(filterByChildBaseNodeCount, label, 'engagement');
    }
    // match on the rest of the properties of the object requested
    listQuery
      .call(addAllSecureProperties, ...secureProps, ...unsecureProps)

      // form return object
      .with(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithUnsecureObject(unsecureProps)},
            ${listWithSecureObject(secureProps)}
          }
          as node
        `
      );
    return runListQuery<Project>(
      listQuery,
      input,
      secureProps.includes(input.sort)
    );
  }

  async listEngagements(
    project: Project,
    input: EngagementListInput,
    session: ISession
  ): Promise<SecuredEngagementList> {
    this.logger.info('list engagements ', {
      projectId: project.id,
      input,
      userId: session.userId,
    });
    //get a list of engagements
    const listQuery = this.db.query().call(matchRequestingUser, session);
    listQuery.match([
      node('project', 'Project', { active: true, id: project.id }),
      relation('out', '', 'engagement', { active: true }),
      node('engagement', 'BaseNode', { active: true }),
    ]);
    listQuery.optionalMatch([...this.propMatch('engagement')]).returnDistinct([
      {
        canReadEngagement: [{ read: 'canRead' }],
        engagement: [{ id: 'id' }],
      },
    ]);

    let result;
    try {
      result = await listQuery.run();
    } catch (e) {
      this.logger.error('e :>> ', e);
    }

    const items = result
      ? await Promise.all(
          result.map((r) => this.engagementService.readOne(r.id, session))
        )
      : [];

    const retVal: SecuredEngagementList = {
      total: items.length,
      hasMore: false,
      items,
      canRead: true,
      canCreate: true,
    };

    return retVal;
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

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
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

    return {
      ...result,
      canCreate: true,
      canRead: true,
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
  ): Promise<Directory> {
    const rootRef = await this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([
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
    if (!rootRef?.id) {
      throw new NotFoundException(
        'Could not find root directory associated to this project'
      );
    }
    return this.fileService.getDirectory(rootRef.id, session);
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
      .map((p) => p.organization.id);

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
            return this.db.isRelationshipUnique({
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
            return this.db.hasProperties({
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
