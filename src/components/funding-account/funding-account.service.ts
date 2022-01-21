import { Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
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
    try {
      const result = await this.repo.create(input, session);
      return await this.secure(result, session);
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
    const dto = await this.repo.readOne(id);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await Promise.all(
      ids.map(async (id) => {
        return await this.secure(await this.repo.readOne(id), session);
      })
    );
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
    await this.repo.update(fundingAccount, changes);
    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Funding Account');
    }

    let response;
    try {
      response = await this.repo.delete(object);
    } catch (exception) {
      this.logger.error(`Failed to delete: ${response?.body || 'unknown'}`, {
        id,
        exception,
      });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FundingAccountListInput,
    session: Session
  ): Promise<FundingAccountListOutput> {
    const results = await this.repo.list(input);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
