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
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
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
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
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
        node(baseNode),
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
        relation('in', '', 'member', { active: true }),
        node('g', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(editPerm, 'Permission', {
          property,
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(readPerm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
  };

  async create(
    { projectId }: CreateBudget,
    session: ISession
  ): Promise<Budget> {
    this.logger.debug('Creating budget', { projectId });

    const readProject = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('project', 'Project', { active: true, id: projectId })]);
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

    const secureProps: Property[] = [
      {
        key: 'status',
        value: BudgetStatus.Pending,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'BudgetStatus',
      },
    ];

    try {
      const createBudget = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, 'Budget', secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .return('node.id as id');

      const result = await createBudget.first();

      if (!result) {
        throw new ServerException('failed to create a budget');
      }

      // connect budget to project
      await this.db
        .query()
        .matchNode('project', 'Project', { id: projectId, active: true })
        .matchNode('budget', 'Budget', { id: result.id, active: true })
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
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'amount',
        value: null,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const createBudgetRecord = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ]);
      createBudgetRecord.call(createBaseNode, 'BudgetRecord', secureProps, {
        owningOrgId: session.owningOrgId,
      });
      createBudgetRecord
        .create([...this.permission('organization', 'node')])
        .return('node.id as id');

      const result = await createBudgetRecord.first();

      if (!result) {
        throw new ServerException('failed to create a budget record');
      }

      this.logger.debug(`Created Budget Record`, {
        id: result.id,
        userId: session.userId,
      });

      // connect to budget
      const query = this.db
        .query()
        .match([node('budget', 'Budget', { id: budgetId, active: true })])
        .match([node('br', 'BudgetRecord', { id: result.id, active: true })])
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
            active: true,
          }),
        ])
        .match([node('br', 'BudgetRecord', { id: result.id, active: true })])
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
      .match([node('node', 'Budget', { active: true, id })])
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
      .match([node('node', 'BudgetRecord', { active: true, id })])
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
      .match([
        node('node'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization', { active: true }),
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

  async update(input: UpdateBudget, session: ISession): Promise<Budget> {
    const budget = await this.readOne(input.id, session);

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
        node('budgetRecord', 'BudgetRecord', { active: true, id }),
        relation('in', '', 'record', {
          active: true,
        }),
        node('budget', 'Budget', { active: true }),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property', { active: true }),
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
                active: true,
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
                node('prop', 'Property', { active: true }),
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
                active: true,
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
                node('prop', 'Property', { active: true }),
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
      .match([
        matchSession(session),
        [
          node('budget', 'Budget', {
            active: true,
          }),
        ],
      ])
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
