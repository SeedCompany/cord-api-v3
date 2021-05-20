import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  runListQuery,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  FundingAccountListOutput,
  UpdateFundingAccount,
} from './dto';
import { FundingAccountRepository } from './funding-account.repository';
import { DbFundingAccount } from './model';

@Injectable()
export class FundingAccountService {
  constructor(
    @Logger('funding-account:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: FundingAccountRepository
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
    const checkFundingAccount = await this.repo.checkFundingAccount(input.name);

    if (checkFundingAccount) {
      throw new DuplicateException(
        'fundingAccount.name',
        'FundingAccount with this name already exists.'
      );
    }

    try {
      const result = await this.repo.create(input, session);

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

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException('FundingAccount.id', 'id');
    }

    const secured = await this.authorizationService.secureProperties({
      resource: FundingAccount,
      props: result.propList,
      sessionOrUserId: session,
    });
    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      canDelete: await this.repo.checkDeletePermission(id, session),
    };
  }

  async update(
    input: UpdateFundingAccount,
    session: Session
  ): Promise<FundingAccount> {
    const fundingAccount = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(fundingAccount, input);
    await this.authorizationService.verifyCanEditChanges(
      FundingAccount,
      fundingAccount,
      changes
    );
    return await this.repo.updateProperties(fundingAccount, changes);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Funding Account');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Funding Account'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FundingAccountListInput,
    session: Session
  ): Promise<FundingAccountListOutput> {
    const query = this.repo.list(input, session);
    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
