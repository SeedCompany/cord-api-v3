import { Injectable, NotFoundException } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { DuplicateException, ISession, ServerException } from '../../common';
import {
  addUserToSG,
  ConfigService,
  createBaseNode,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  StandardReadResult,
} from '../../core/database/results';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  FundingAccountListOutput,
  UpdateFundingAccount,
} from './dto';

@Injectable()
export class FundingAccountService {
  constructor(
    @Logger('fundingAccount:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  async create(
    input: CreateFundingAccount,
    session: ISession
  ): Promise<FundingAccount> {
    const checkFundingAccount = await this.db
      .query()
      .match([node('fundingAccount', 'FieldZoneName', { value: input.name })])
      .return('fundingAccount')
      .first();

    if (checkFundingAccount) {
      throw new DuplicateException(
        'fundingAccount.name',
        'FundingAccount with this name already exists.'
      );
    }

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'FieldZoneName',
      },
    ];

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('rootUser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, ['FundingAccount', 'BaseNode'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a funding account');
      }

      const id = result.id;

      // add root admin to new funding account as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'FundingAccount');

      this.logger.info(`funding account created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error('Could not create funding account for user', {
        exception: err,
        userId: session.userId,
      });
      throw new ServerException('Could not create funding account');
    }
  }

  async readOne(id: string, session: ISession): Promise<FundingAccount> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given');
    }

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const readFundingAccount = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FundingAccount', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<FundingAccount>>>();

    const result = await readFundingAccount.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find funding account',
        'FundingAccount.id'
      );
    }

    const secured = parseSecuredProperties(result.propList, result.permList, {
      name: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
    };
  }

  async update(
    input: UpdateFundingAccount,
    session: ISession
  ): Promise<FundingAccount> {
    const fundingAccount = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object: fundingAccount,
      props: ['name'],
      changes: input,
      nodevar: 'fundingAccount',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const fundingAccount = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: fundingAccount,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted funding account with id`, { id });
  }

  async list(
    input: FundingAccountListInput,
    session: ISession
  ): Promise<FundingAccountListOutput> {
    const label = 'FundingAccount';
    const secureProps = ['name'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    const result: FundingAccountListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = await Promise.all(
      result.items.map((row: any) => this.readOne(row.properties.id, session))
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
