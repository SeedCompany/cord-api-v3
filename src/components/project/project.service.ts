import {
  Injectable,
  NotFoundException,
  NotImplementedException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { flatMap, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { fiscalYears, ISession, Sensitivity } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import { Budget, BudgetService, BudgetStatus, SecuredBudget } from '../budget';
import { EngagementListInput, SecuredEngagementList } from '../engagement';
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
  ProjectStep,
  stepToStatus,
  UpdateProject,
} from './dto';
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
    private readonly budgets: BudgetService,
    private readonly partnerships: PartnershipService,
    private readonly fileService: FileService,
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
  property = (prop: string, value: any) => {
    if (!value) {
      return [];
    }
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
  permission = (property: string) => {
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
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newProject'),
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

  async readOne(id: string, session: ISession): Promise<Project> {
    const readProject = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('project', 'Project', { active: true, id })])
      .optionalMatch([...this.propMatch('type')])
      .optionalMatch([...this.propMatch('sensitivity')])
      .optionalMatch([...this.propMatch('name')])
      .optionalMatch([...this.propMatch('step')])
      .optionalMatch([...this.propMatch('status')])
      .optionalMatch([...this.propMatch('mouStart')])
      .optionalMatch([...this.propMatch('mouEnd')])
      .optionalMatch([...this.propMatch('estimatedSubmission')])
      .optionalMatch([...this.propMatch('modifiedAt')])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadLocation', 'Permission', {
          property: 'location',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('project'),
        relation('out', '', 'location', { active: true }),
        node('country', 'Country', { active: true }),
      ])

      .return({
        project: [{ id: 'id', createdAt: 'createdAt' }],
        type: [{ value: 'type' }],
        canReadType: [
          {
            read: 'canReadTypeRead',
            edit: 'canReadTypeEdit',
          },
        ],
        sensitivity: [{ value: 'sensitivity' }],
        canReadSensitivity: [
          { read: 'canReadSensitivityRead', edit: 'canReadSensitivitysEdit' },
        ],
        name: [{ value: 'name' }],
        canReadName: [
          {
            read: 'canReadNameRead',
            edit: 'canReadNameEdit',
          },
        ],
        step: [{ value: 'step' }],
        canReadStep: [
          {
            read: 'canReadStepRead',
            edit: 'canReadStepEdit',
          },
        ],
        status: [{ value: 'status' }],
        canReadStatus: [
          {
            read: 'canReadStatusRead',
            edit: 'canReadStatusEdit',
          },
        ],
        mouStart: [{ value: 'mouStart' }],
        canReadMouStart: [
          {
            read: 'canReadMouStartRead',
            edit: 'canReadMouStartEdit',
          },
        ],
        mouEnd: [{ value: 'mouEnd' }],
        canReadMouEnd: [
          {
            read: 'canReadMouEndRead',
            edit: 'canReadMouEndEdit',
          },
        ],
        estimatedSubmission: [{ value: 'estimatedSubmission' }],
        canReadEstimatedSubmission: [
          {
            read: 'canReadEstimatedSubmissionRead',
            edit: 'canReadEstimatedSubmissionEdit',
          },
        ],
        modifiedAt: [{ value: 'modifiedAt' }],
        canReadModifiedAt: [
          {
            read: 'canReadModifiedAtRead',
            edit: 'canReadModifiedAtEdit',
          },
        ],
        country: [{ id: 'contryId' }],
        canReadLocation: [
          {
            read: 'canReadLocationRead',
            edit: 'canReadLocationEdit',
          },
        ],
      });

    let result;
    try {
      result = await readProject.first();
    } catch (e) {
      this.logger.error('e :>> ', e);
    }

    if (!result) {
      throw new NotFoundException('Could not find project');
    }

    const location = result.country
      ? this.locationService
          .readOneCountry(result.country.properties.id, session)
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
      createdAt: result.createdAt,
      modifiedAt: result.modifiedAt,
      type: result.type,
      sensitivity: result.sensitivity,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      deptId: {
        value: result.deptId,
        canRead: !!result.canReadDeptId,
        canEdit: !!result.canEditDeptId,
      },
      step: {
        value: result.step,
        canRead: !!result.canReadStep,
        canEdit: !!result.canEditStep,
      },
      status: result.status,
      location: {
        ...location,
        canRead: !!result.canReadLocation,
        canEdit: !!result.canEditLocation,
      },
      mouStart: {
        value: result.mouStart,
        canRead: !!result.canReadMouStart,
        canEdit: !!result.canEditMouStart,
      },
      mouEnd: {
        value: result.mouEnd,
        canRead: !!result.canReadMouEnd,
        canEdit: !!result.canEditMouEnd,
      },
      estimatedSubmission: {
        value: result.estimatedSubmission,
        canRead: !!result.canReadEstimatedSubmission,
        canEdit: !!result.canEditEstimatedSubmission,
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: ProjectListInput,
    session: ISession
  ): Promise<ProjectListOutput> {
    const result = await this.db.list<Project>({
      session,
      nodevar: 'project',
      aclReadProp: 'canReadProjects',
      aclEditProp: 'canCreateProject',
      props: [
        { name: 'type', secure: false },
        { name: 'sensitivity', secure: false },
        { name: 'name', secure: true },
        { name: 'deptId', secure: true },
        { name: 'step', secure: true },
        { name: 'status', secure: false },
        { name: 'location', secure: true },
        { name: 'mouStart', secure: true },
        { name: 'mouEnd', secure: true },
        { name: 'estimatedSubmission', secure: true },
        { name: 'modifiedAt', secure: false },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
    return {
      items: result.items.map((item) => ({
        ...item,
        location: {
          value: undefined,
          canEdit: true,
          canRead: true,
        },
      })),
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async currentBudget(
    project: Project,
    session: ISession
  ): Promise<SecuredBudget> {
    const budgets = await this.budgets.list(
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

    return {
      value: current,
      canEdit: true,
      canRead: true,
    };
  }

  async listEngagements(
    _project: Project,
    _input: EngagementListInput,
    _session: ISession
  ): Promise<SecuredEngagementList> {
    // Maybe call EngagementService?
    throw new NotImplementedException();
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

  async create(
    { locationId, ...input }: CreateProject,
    session: ISession
  ): Promise<Project> {
    const id = generate();
    const createdAt = DateTime.local();

    const createInput = {
      id,
      sensitivity: Sensitivity.High, // TODO: this needs to be calculated based on language engagement
      step: ProjectStep.EarlyConversations,
      status: stepToStatus(ProjectStep.EarlyConversations),
      modifiedAt: DateTime.local(),
      ...input,
    };

    try {
      const createProject = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateProject' }))
        .create([
          [
            node('newProject', 'Project:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('type', createInput.type),
          ...this.property('sensitivity', createInput.sensitivity),
          ...this.property('name', createInput.name),
          ...this.property('step', createInput.step),
          ...this.property('status', createInput.status),
          ...this.property('mouStart', createInput.mouStart),
          ...this.property('mouEnd', createInput.mouEnd),
          ...this.property(
            'estimatedSubmission',
            createInput.estimatedSubmission
          ),
          ...this.property('modifiedAt', createInput.modifiedAt),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: `${input.name} ${input.type} admin`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: `${input.name} ${input.type} users`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('type'),
          ...this.permission('sensitivity'),
          ...this.permission('name'),
          ...this.permission('step'),
          ...this.permission('status'),
          ...this.permission('mouStart'),
          ...this.permission('mouEnd'),
          ...this.permission('estimatedSubmission'),
          ...this.permission('modifiedAt'),
        ])
        .return('newProject.id as id');

      try {
        await createProject.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }

      // Create root directory
      const rootDir = await this.fileService.createDirectory(
        undefined,
        `${id} root directory`,
        session
      );
      await this.db
        .query()
        .match([
          [node('project', 'Project', { id, active: true })],
          [node('dir', 'Directory', { id: rootDir.id, active: true })],
        ])
        .create([
          node('project'),
          relation('out', '', 'rootDirectory', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('dir'),
        ])
        .run();

      const qry = `
        MATCH
          (project:Project {id: "${id}", active: true})-[:name]->(proName:Property),
          (project:Project)-[:step]->(proStep:Property {active: true}),
          (project:Project)-[:status]->(proStatus:Property {active: true})
        SET proName :ProjectName, proStep :ProjectStep, proStatus :ProjectStatus
        RETURN project.id
      `;
      await this.db
        .query()
        .raw(qry, {
          id,
        })
        .run();

      if (locationId) {
        const query = `
            MATCH (country:Country {id: $locationId, active: true}),
              (project:Project {id: $id, active: true})
            CREATE (project)-[:location { active: true, createdAt: datetime()}]->(country)
            RETURN project.id as id
          `;

        await this.db
          .query()
          .raw(query, {
            locationId,
            id,
          })
          .first();
      }
      await this.projectMembers.create(
        {
          userId: session.userId!,
          projectId: id,
          roles: [Role.ProjectManager],
        },
        session
      );

      const project = await this.readOne(id, session);

      await this.createBudget(project, session);

      return project;
    } catch (e) {
      this.logger.warning(`Could not create project`, {
        exception: e,
      });
      throw new ServerException('Could not create project');
    }
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
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete project', {
        exception: e,
      });
      throw new ServerException('Failed to delete project');
    }
  }

  async createBudget(
    project: Pick<Project, 'id' | 'mouStart' | 'mouEnd'>,
    session: ISession
  ): Promise<Budget> {
    const budget = await this.budgets.create(
      { projectId: project.id },
      session
    );

    // connect budget to project
    await this.db
      .query()
      .matchNode('project', 'Project', { id: project.id, active: true })
      .matchNode('budget', 'Budget', { id: budget.id, active: true })
      .create([
        node('project'),
        relation('out', '', 'budget', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('budget'),
      ])
      .run();

    const records = await this.attachBudgetRecords(budget, project, session);

    return {
      ...budget,
      records,
    };
  }

  private async attachBudgetRecords(
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
      inputRecords.map((record) => this.budgets.createRecord(record, session))
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
              props: ['type', 'status', 'name', 'step'],
              nodevar: 'Project',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
