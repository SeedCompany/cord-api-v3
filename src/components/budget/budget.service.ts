import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import {
  InputException,
  ISession,
  NotFoundException,
  Order,
  ServerException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  Property,
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
import { AuthorizationService } from '../authorization/authorization.service';
import { FileService } from '../file';
import { InternalRole } from '../project';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  BudgetRecord,
  BudgetRecordListInput,
  BudgetRecordListOutput,
  BudgetStatus,
  CreateBudget,
  CreateBudgetRecord,
  UpdateBudget,
  UpdateBudgetRecord,
} from './dto';

@Injectable()
export class BudgetService {
  private readonly securedProperties = {
    status: true,
    universalTemplateFile: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly files: FileService,
    private readonly authorizationService: AuthorizationService,
    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          value,
        }),
      ],
    ];
  };

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode'),
        node(baseNode),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode'),
        node(baseNode),
      ],
    ];
  };

  propMatch = (query: Query, property: string, baseNode: string) => {
    const readPerm = 'canRead' + upperFirst(property);
    const editPerm = 'canEdit' + upperFirst(property);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member'),
        node('g', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node(editPerm, 'Permission', {
          property,
          edit: true,
        }),
        relation('out', '', 'baseNode'),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property'),
      ],
    ]);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node(readPerm, 'Permission', {
          property,
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property'),
      ],
    ]);
  };

  async create(
    { projectId, ...input }: CreateBudget,
    session: ISession
  ): Promise<Budget> {
    this.logger.debug('Creating budget', { projectId });

    const readProject = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('project', 'Project', { id: projectId })]);
    readProject.return({
      project: [{ id: 'id', createdAt: 'createdAt' }],
      requestingUser: [
        {
          canReadProjects: 'canReadProjects',
          canCreateProject: 'canCreateProject',
        },
      ],
    });

    const result = await readProject.first();
    if (!result) {
      throw new NotFoundException('project does not exist', 'budget.projectId');
    }

    const universalTemplateFile = await this.files.createDefinedFile(
      `Universal Budget Template`,
      session,
      input.universalTemplateFile,
      'budget.universalTemplateFile'
    );

    const secureProps: Property[] = [
      {
        key: 'status',
        value: BudgetStatus.Pending,
        isPublic: false,
        isOrgPublic: false,
        label: 'BudgetStatus',
      },
      {
        key: 'universalTemplateFile',
        value: universalTemplateFile,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const createBudget = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, 'Budget', secureProps)
        .return('node.id as id');

      const result = await createBudget.first();

      if (!result) {
        throw new ServerException('failed to create a budget');
      }

      // connect budget to project
      await this.db
        .query()
        .matchNode('project', 'Project', { id: projectId })
        .matchNode('budget', 'Budget', { id: result.id })
        .create([
          node('project'),
          relation('out', '', 'budget', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('budget'),
        ])
        .run();

      this.logger.debug(`Created Budget`, {
        id: result.id,
        userId: session.userId,
      });

      await this.authorizationService.addPermsForRole({
        userId: session.userId as string,
        baseNodeId: result.id,
        role: InternalRole.Admin,
      });

      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create budget`, {
        userId: session.userId,
        exception,
      });
      throw new ServerException('Could not create budget', exception);
    }
  }

  async createRecord(
    { budgetId, organizationId, ...input }: CreateBudgetRecord,
    session: ISession
  ): Promise<BudgetRecord> {
    if (!input.fiscalYear || !organizationId) {
      throw new InputException(
        !input.fiscalYear ? 'budget.fiscalYear' : 'budget.organizationId'
      );
    }

    this.logger.debug('Creating BudgetRecord', input);
    // on Init, create a budget will create a budget record for each org and each fiscal year in the project input.projectId
    const createdAt = DateTime.local();

    const secureProps: Property[] = [
      {
        key: 'fiscalYear',
        value: input.fiscalYear,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'amount',
        value: null,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const createBudgetRecord = this.db
        .query()
        .call(matchRequestingUser, session);
      createBudgetRecord
        .call(createBaseNode, 'BudgetRecord', secureProps)
        .create([...this.permission('organization', 'node')]);
      createBudgetRecord.return('node.id as id');

      const result = await createBudgetRecord.first();

      if (!result) {
        throw new ServerException('failed to create a budget record');
      }

      await this.authorizationService.addPermsForRole({
        userId: session.userId as string,
        baseNodeId: result.id,
        role: InternalRole.Admin,
      });

      this.logger.debug(`Created Budget Record`, {
        id: result.id,
        userId: session.userId,
      });

      // connect to budget
      const query = this.db
        .query()
        .match([node('budget', 'Budget', { id: budgetId })])
        .match([node('br', 'BudgetRecord', { id: result.id })])
        .create([
          node('budget'),
          relation('out', '', 'record', { active: true, createdAt }),
          node('br'),
        ])
        .return('br');
      await query.first();

      // connect budget record to org
      const orgQuery = this.db
        .query()
        .match([
          node('organization', 'Organization', {
            id: organizationId,
          }),
        ])
        .match([node('br', 'BudgetRecord', { id: result.id })])
        .create([
          node('br'),
          relation('out', '', 'organization', { active: true, createdAt }),
          node('organization'),
        ])
        .return('br');
      await orgQuery.first();

      const bugetRecord = await this.readOneRecord(result.id, session);

      return bugetRecord;
    } catch (exception) {
      this.logger.error(`Could not create Budget Record`, {
        userId: session.userId,
        exception,
      });
      throw new ServerException('Could not create Budget Record', exception);
    }
  }

  async readOne(id: string, session: ISession): Promise<Budget> {
    this.logger.debug(`Query readOne Budget: `, {
      id,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Budget', { id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('perms', 'Permission'),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property'),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Budget>>>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find budget', 'budget.id');
    }

    const records = await this.listRecords(
      {
        sort: 'fiscalYear',
        order: Order.ASC,
        page: 1,
        count: 25,
        filter: { budgetId: id },
      },
      session
    );

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(props, result.permList, {
      status: true,
      universalTemplateFile: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      status: props.status,
      records: records.items,
    };
  }

  async readOneRecord(id: string, session: ISession): Promise<BudgetRecord> {
    this.logger.debug(`Query readOne Budget Record: `, {
      id,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'BudgetRecord', { id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('perms', 'Permission'),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property'),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .match([
        node('node'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .return([
        'propList + [{value: organization.id, property: "organization"}] as propList',
        'permList',
        'node',
      ])
      .asResult<StandardReadResult<DbPropsOfDto<BudgetRecord>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find BudgetRecord',
        'budgetRecord.budgetId'
      );
    }

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(props, result.permList, {
      amount: true,
      fiscalYear: true,
      organization: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
    };
  }

  async update(
    { universalTemplateFile, ...input }: UpdateBudget,
    session: ISession
  ): Promise<Budget> {
    const budget = await this.readOne(input.id, session);

    await this.files.updateDefinedFile(
      budget.universalTemplateFile,
      'budget.universalTemplateFile',
      universalTemplateFile,
      session
    );

    return await this.db.sgUpdateProperties({
      session,
      object: budget,
      props: ['status'],
      changes: input,
      nodevar: 'budget',
    });
  }

  async updateRecord(
    { id, ...input }: UpdateBudgetRecord,
    session: ISession
  ): Promise<BudgetRecord> {
    this.logger.debug('Update budget Record, ', { id, userId: session.userId });

    // 574 - Budget records are only editable if the budget is pending
    // Get budget status
    const budgetStatusQuery = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadBudgets' }))
      .match([
        node('budgetRecord', 'BudgetRecord', { id }),
        relation('in', '', 'record', {
          active: true,
        }),
        node('budget', 'Budget'),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property'),
      ]);
    budgetStatusQuery.return([
      {
        budget: [{ id: 'id' }],
        status: [{ value: 'status' }],
      },
    ]);

    const readBudget = await budgetStatusQuery.first();
    if (!readBudget?.status.includes(BudgetStatus.Pending)) {
      throw new InputException(
        'budget records can not be modified',
        'budgetRecord.id'
      );
    }

    const br = await this.readOneRecord(id, session);

    try {
      const result = await this.db.sgUpdateProperties({
        session,
        object: br,
        props: ['amount'],
        changes: { id, ...input },
        nodevar: 'budgetRecord',
      });
      return result;
    } catch (e) {
      this.logger.error('Could not update budget Record ', {
        id,
        userId: session.userId,
      });
      throw e;
    }
  }

  async delete(id: string, session: ISession): Promise<void> {
    const budget = await this.readOne(id, session);

    // cascade delete each budget record in this budget
    await Promise.all(
      budget.records.map((br) => this.deleteRecord(br.id, session))
    );
    await this.db.deleteNode({
      session,
      object: budget,
      aclEditProp: 'canCreateBudget',
    });
  }

  async deleteRecord(id: string, session: ISession): Promise<void> {
    const br = await this.readOneRecord(id, session);
    await this.db.deleteNode({
      session,
      object: br,
      aclEditProp: 'canCreateBudget',
    });
  }

  async list(
    input: Partial<BudgetListInput>,
    session: ISession
  ): Promise<BudgetListOutput> {
    const { filter, ...listInput } = {
      ...BudgetListInput.defaultVal,
      ...input,
    };

    const label = 'Budget';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'budget', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList, listInput, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property'),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, listInput, (id) =>
      this.readOne(id, session)
    );
  }

  async listRecords(
    { filter, ...input }: BudgetRecordListInput,
    session: ISession
  ): Promise<BudgetRecordListOutput> {
    const label = 'BudgetRecord';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.budgetId
          ? [
              relation('in', '', 'record', { active: true }),
              node('budget', 'Budget', {
                id: filter.budgetId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property'),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) =>
      this.readOneRecord(id, session)
    );
  }

  async checkBudgetConsistency(session: ISession): Promise<boolean> {
    const budgets = await this.db
      .query()
      .match([matchSession(session), [node('budget', 'Budget')]])
      .return('budget.id as id')
      .run();

    return (
      (
        await Promise.all(
          budgets.map(async (budget) => {
            return await this.db.hasProperties({
              session,
              id: budget.id,
              props: ['status'],
              nodevar: 'budget',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          budgets.map(async (budget) => {
            return await this.db.isUniqueProperties({
              session,
              id: budget.id,
              props: ['status'],
              nodevar: 'budget',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
