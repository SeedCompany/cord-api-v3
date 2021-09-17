import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
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
    private readonly authorizationService: AuthorizationService,
    private readonly repo: FundingAccountRepository
  ) {}

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

      await this.authorizationService.processNewBaseNode(
        FundingAccount,
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

  @HandleIdLookup(FundingAccount)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<FundingAccount> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('Invalid: Blank ID');
    }

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  private async secure(
    dto: UnsecuredDto<FundingAccount>,
    session: Session
  ): Promise<FundingAccount> {
    const securedProps = await this.authorizationService.secureProperties(
      FundingAccount,
      dto,
      session
    );
    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
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
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
