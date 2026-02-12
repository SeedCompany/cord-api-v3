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
  type UnsecuredDto,
} from '~/common';
import { mapListResults } from '~/core/database/results';
import { HandleIdLookup } from '~/core/resources';
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

  async create(input: CreateFundingAccount): Promise<FundingAccount> {
    this.privileges.for(FundingAccount).verifyCan('create');
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'name',
        'FundingAccount with this name already exists.',
      );
    }

    try {
      const result = await this.repo.create(input);

      if (!result) {
        throw new CreationFailed(FundingAccount);
      }

      return await this.readOne(result.id).catch((e) => {
        throw e instanceof NotFoundException
          ? new ReadAfterCreationFailed(FundingAccount)
          : e;
      });
    } catch (err) {
      throw new CreationFailed(FundingAccount, { cause: err });
    }
  }

  @HandleIdLookup(FundingAccount)
  async readOne(id: ID, _view?: ObjectView): Promise<FundingAccount> {
    const result = await this.repo.readOne(id);
    return await this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const fundingAccounts = await this.repo.readMany(ids);
    return await Promise.all(fundingAccounts.map((dto) => this.secure(dto)));
  }

  private async secure(
    dto: UnsecuredDto<FundingAccount>,
  ): Promise<FundingAccount> {
    return this.privileges.for(FundingAccount).secure(dto);
  }

  async update(input: UpdateFundingAccount): Promise<FundingAccount> {
    const fundingAccount = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fundingAccount, input);
    this.privileges.for(FundingAccount, fundingAccount).verifyChanges(changes);
    const updated = await this.repo.update({ id: input.id, ...changes });
    return await this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(FundingAccount, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FundingAccountListInput,
  ): Promise<FundingAccountListOutput> {
    if (this.privileges.for(FundingAccount).can('read')) {
      const results = await this.repo.list(input);
      return await mapListResults(results, (dto) => this.secure(dto));
    } else {
      return SecuredList.Redacted;
    }
  }
}
