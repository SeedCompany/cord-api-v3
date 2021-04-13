import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  DuplicateException,
  generateId,
  ID,
  NotFoundException,
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
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
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
    ];
  }

  async create(
    input: CreateFundingAccount,
    session: Session
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
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
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
        session.userId
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

  async readOne(id: ID, session: Session): Promise<FundingAccount> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('Invalid: Blank ID');
    }

    const readFundingAccount = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FundingAccount', { id })])
      .call(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<FundingAccount>>>();

    const result = await readFundingAccount.first();

    if (!result) {
      throw new NotFoundException('FundingAccount.id', 'id');
    }

    const secured = await this.authorizationService.secureProperties(
      FundingAccount,
      result.propList,
      session
    );
    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    input: UpdateFundingAccount,
    session: Session
  ): Promise<FundingAccount> {
    const fundingAccount = await this.readOne(input.id, session);
    const changes = this.db.getActualChanges(
      FundingAccount,
      fundingAccount,
      input
    );
    await this.authorizationService.verifyCanEditChanges(
      FundingAccount,
      fundingAccount,
      changes
    );
    return await this.db.updateProperties({
      type: FundingAccount,
      object: fundingAccount,
      changes: changes,
    });
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Funding Account');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Funding Account'
      );

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FundingAccountListInput,
    session: Session
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
