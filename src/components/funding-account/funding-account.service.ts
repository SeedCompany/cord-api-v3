import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  FundingAccountListOutput,
  UpdateFundingAccount,
} from './dto';
import { FundingAccountRepository } from './funding-account.repository';

@Injectable()
export class FundingAccountService {
  constructor(
    @Logger('funding-account:service') private readonly logger: ILogger,
    private readonly privileges: Privileges,
    private readonly repo: FundingAccountRepository,
  ) {}

  async create(
    input: CreateFundingAccount,
    session: Session,
  ): Promise<FundingAccount> {
    this.privileges.for(session, FundingAccount).verifyCan('create');
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'fundingAccount.name',
        'FundingAccount with this name already exists.',
      );
    }

    try {
      const result = await this.repo.create(input);

      if (!result) {
        throw new ServerException('Failed to create funding account');
      }

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

  @HandleIdLookup(FundingAccount)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<FundingAccount> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('Invalid: Blank ID');
    }

    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const fundingAccounts = await this.repo.readMany(ids);
    return await Promise.all(
      fundingAccounts.map((dto) => this.secure(dto, session)),
    );
  }

  private async secure(
    dto: UnsecuredDto<FundingAccount>,
    session: Session,
  ): Promise<FundingAccount> {
    return this.privileges.for(session, FundingAccount).secure(dto);
  }

  async update(
    input: UpdateFundingAccount,
    session: Session,
  ): Promise<FundingAccount> {
    const fundingAccount = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fundingAccount, input);
    this.privileges
      .for(session, FundingAccount, fundingAccount)
      .verifyChanges(changes);
    const updated = await this.repo.update({ id: input.id, ...changes });
    return await this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, FundingAccount, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FundingAccountListInput,
    session: Session,
  ): Promise<FundingAccountListOutput> {
    if (this.privileges.for(session, FundingAccount).can('read')) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }
}
