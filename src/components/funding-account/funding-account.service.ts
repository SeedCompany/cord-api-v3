import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  NotFoundException,
  type ObjectView,
  ReadAfterCreationFailed,
  SecuredList,
  ServerException,
  type Session,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { mapListResults } from '~/core/database/results';
import { Privileges } from '../authorization';
import {
  type CreateFundingAccount,
  FundingAccount,
  type FundingAccountListInput,
  type FundingAccountListOutput,
  type UpdateFundingAccount,
} from './dto';
import { FundingAccountRepository } from './funding-account.repository';

@Injectable()
export class FundingAccountService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: FundingAccountRepository,
  ) {}

  async create(
    input: CreateFundingAccount,
    session: Session,
  ): Promise<FundingAccount> {
    this.privileges.for(FundingAccount).verifyCan('create');
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'fundingAccount.name',
        'FundingAccount with this name already exists.',
      );
    }

    try {
      const result = await this.repo.create(input);

      if (!result) {
        throw new CreationFailed(FundingAccount);
      }

      return await this.readOne(result.id, session).catch((e) => {
        throw e instanceof NotFoundException
          ? new ReadAfterCreationFailed(FundingAccount)
          : e;
      });
    } catch (err) {
      throw new CreationFailed(FundingAccount, { cause: err });
    }
  }

  @HandleIdLookup(FundingAccount)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<FundingAccount> {
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
    return this.privileges.for(FundingAccount).secure(dto);
  }

  async update(
    input: UpdateFundingAccount,
    session: Session,
  ): Promise<FundingAccount> {
    const fundingAccount = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fundingAccount, input);
    this.privileges.for(FundingAccount, fundingAccount).verifyChanges(changes);
    const updated = await this.repo.update({ id: input.id, ...changes });
    return await this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(FundingAccount, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FundingAccountListInput,
    session: Session,
  ): Promise<FundingAccountListOutput> {
    if (this.privileges.for(FundingAccount).can('read')) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }
}
