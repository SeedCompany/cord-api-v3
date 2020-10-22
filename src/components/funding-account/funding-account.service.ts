import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  DuplicateException,
  generateId,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchPermList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  FundingAccountListOutput,
  UpdateFundingAccount,
} from './dto';
import { DbFundingAccount } from './model';

@Injectable()
export class FundingAccountService {
  private readonly securedProperties = {
    name: true,
    accountNumber: true,
  };

  constructor(
    @Logger('funding-account:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:FundingAccount) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:FundingAccountName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FundingAccountName) ASSERT n.value IS UNIQUE',

      'CREATE CONSTRAINT ON ()-[r:accountNumber]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:accountNumber]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:FundingAccountNumber) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FundingAccountNumber) ASSERT n.value IS UNIQUE',
    ];
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
        isPublic: false,
        isOrgPublic: false,
        label: 'FundingAccountName',
      },
      {
        key: 'accountNumber',
        value: input.accountNumber,
        isPublic: false,
        isOrgPublic: false,
        label: 'FundingAccountNumber',
      },
    ];

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, await generateId(), 'FundingAccount', secureProps)
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('Failed to create funding account');
      }

      const dbFundingAccount = new DbFundingAccount();
      await this.authorizationService.processNewBaseNode(
        dbFundingAccount,
        result.id,
        session.userId as string
      );

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
      throw new NotFoundException('Invalid: Blank ID');
    }

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const readFundingAccount = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FundingAccount', { id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<FundingAccount>>>();

    const result = await readFundingAccount.first();

    if (!result) {
      throw new NotFoundException('FundingAccount.id', 'id');
    }

    const secured = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );

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
      props: ['name', 'accountNumber'],
      changes: input,
      nodevar: 'fundingAccount',
    });
  }

  async delete(_id: string, _session: ISession): Promise<void> {
    // Not implemented
  }

  async list(
    input: FundingAccountListInput,
    session: ISession
  ): Promise<FundingAccountListOutput> {
    const label = 'FundingAccount';

    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
