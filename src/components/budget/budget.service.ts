import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  InputException,
  NotFoundException,
  Order,
  ServerException,
  Session,
  UnauthorizedException,
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
  defaultSorter,
  matchMemberRoles,
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
import { Role, rolesForScope } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import { FileService } from '../file';
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
import { DbBudget } from './model';
import { DbBudgetRecord } from './model/budget-record.model.db';

@Injectable()
export class BudgetService {
  private readonly securedBudgetProperties = {
    status: true,
    records: true,
    universalTemplateFile: true,
  };

  private readonly securedBudgetRecordProperties = {
    organization: true,
    fiscalYear: true,
    amount: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly files: FileService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  async create(
    { projectId, ...input }: CreateBudget,
    session: Session
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

    const budgetId = await generateId();

    const universalTemplateFileId = await generateId();

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
        value: universalTemplateFileId,
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
      const createBudget = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, budgetId, 'Budget', secureProps)
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

      await this.files.createDefinedFile(
        universalTemplateFileId,
        `Universal Budget Template`,
        session,
        budgetId,
        'universalTemplateFile',
        input.universalTemplateFile,
        'budget.universalTemplateFile'
      );

      const dbBudget = new DbBudget();
      await this.authorizationService.processNewBaseNode(
        dbBudget,
        result.id,
        session.userId
      );

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
    session: Session
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
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const createBudgetRecord = this.db
        .query()
        .call(matchRequestingUser, session);
      createBudgetRecord.call(
        createBaseNode,
        await generateId(),
        'BudgetRecord',
        secureProps
      );
      createBudgetRecord.return('node.id as id');

      const result = await createBudgetRecord.first();

      if (!result) {
        throw new ServerException('failed to create a budget record');
      }

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

      const dbBudgetRecord = new DbBudgetRecord();
      await this.authorizationService.processNewBaseNode(
        dbBudgetRecord,
        result.id,
        session.userId
      );

      this.logger.debug(`Created Budget Record`, {
        id: result.id,
        userId: session.userId,
      });

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

  async readOne(id: string, session: Session): Promise<Budget> {
    this.logger.debug(`Query readOne Budget: `, {
      id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Budget', { id })])
      .call(matchPropList)
      .optionalMatch([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('node', 'Budget', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .call(matchMemberRoles, session.userId)
      .return(['propList', 'node', 'memberRoles'])
      .asResult<
        StandardReadResult<DbPropsOfDto<Budget>> & {
          memberRoles: Role[][];
        }
      >();

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
    const securedProps = await this.authorizationService.secureProperties(
      Budget,
      props,
      session,
      result.memberRoles.flat().map(rolesForScope('project'))
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      status: props.status,
      records: records.items,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async readOneRecord(id: string, session: Session): Promise<BudgetRecord> {
    this.logger.debug(`Query readOne Budget Record: `, {
      id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'BudgetRecord', { id })])
      .call(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('', 'Budget'),
        relation('out', '', 'record', { active: true }),
        node('node', 'BudgetRecord', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .call(matchMemberRoles, session.userId)
      .match([
        node('node'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .with(['node', 'propList', 'organization', 'memberRoles'])
      .return([
        'propList + [{value: organization.id, property: "organization"}] as propList',
        'node',
        'memberRoles',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<BudgetRecord>> & {
          memberRoles: Role[][];
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find BudgetRecord',
        'budgetRecord.budgetId'
      );
    }

    const securedProps = await this.authorizationService.secureProperties(
      BudgetRecord,
      result.propList,
      session,
      result.memberRoles.flat().map(rolesForScope('project'))
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    { universalTemplateFile, ...input }: UpdateBudget,
    session: Session
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
    session: Session
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

  async delete(id: string, session: Session): Promise<void> {
    const budget = await this.readOne(id, session);

    if (!budget) {
      throw new NotFoundException('Could not find Budget');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Budget'
      );

    // cascade delete each budget record in this budget
    await Promise.all(
      budget.records.map((br) => this.deleteRecord(br.id, session))
    );

    const baseNodeLabels = ['BaseNode', 'Budget'];

    try {
      await this.db.deleteNodeNew({
        object: budget,
        baseNodeLabels,
      });
    } catch (e) {
      this.logger.warning('Failed to delete budget', {
        exception: e,
      });
      throw new ServerException('Failed to delete budget');
    }
  }

  async deleteRecord(id: string, session: Session): Promise<void> {
    const br = await this.readOneRecord(id, session);

    if (!br) {
      throw new NotFoundException('Could not find Budget Record');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Budget Record'
      );

    const baseNodeLabels = ['BaseNode', 'Budget'];

    try {
      await this.db.deleteNodeNew({
        object: br,
        baseNodeLabels,
      });
    } catch (e) {
      this.logger.warning('Failed to delete Budget Record', {
        exception: e,
      });
      throw new ServerException('Failed to delete Budget Record');
    }
  }

  async list(
    input: Partial<BudgetListInput>,
    session: Session
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
      .call(
        calculateTotalAndPaginateList,
        listInput,
        this.securedBudgetProperties,
        defaultSorter
      );

    return await runListQuery(query, listInput, (id) =>
      this.readOne(id, session)
    );
  }

  async listRecords(
    { filter, ...input }: BudgetRecordListInput,
    session: Session
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
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedBudgetRecordProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) =>
      this.readOneRecord(id, session)
    );
  }

  async checkBudgetConsistency(session: Session): Promise<boolean> {
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
