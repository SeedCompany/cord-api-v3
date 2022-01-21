import { Injectable } from '@nestjs/common';
import {
  getFromCordTables,
  ID,
  PaginatedListType,
  Session,
  transformToDto,
  transformToPayload,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  CreateFundingAccount,
  FundingAccount,
  FundingAccountListInput,
  TablesFundingAccounts,
  TablesReadFundingAccount,
  UpdateFundingAccount,
} from './dto';

@Injectable()
export class FundingAccountRepository extends DtoRepository(FundingAccount) {
  async create(input: CreateFundingAccount, _session: Session) {
    const response = await getFromCordTables(
      'sc/funding-accounts/create-read',
      {
        fundingAccount: {
          ...transformToPayload(input, FundingAccount.TablesToDto),
        },
      }
    );
    const iFundingAccount: TablesReadFundingAccount = JSON.parse(response.body);

    const dto: UnsecuredDto<FundingAccount> = transformToDto(
      iFundingAccount.fundingAccount,
      FundingAccount.TablesToDto
    );
    return dto;
  }

  async readOne(id: ID): Promise<UnsecuredDto<FundingAccount>> {
    const response = await getFromCordTables('sc/funding-accounts/read', {
      id: id,
    });
    const fundingAccount = response.body;
    const iFundingAccount: TablesReadFundingAccount =
      JSON.parse(fundingAccount);

    const dto: UnsecuredDto<FundingAccount> = transformToDto(
      iFundingAccount.fundingAccount,
      FundingAccount.TablesToDto
    );
    return dto;
  }

  async update(
    fundingAccount: FundingAccount,
    updates: Partial<Omit<UpdateFundingAccount, 'id'>>
  ) {
    const updatePayload = transformToPayload(
      updates,
      FundingAccount.TablesToDto
    );
    Object.entries(updatePayload).forEach(([key, value]) => {
      void getFromCordTables('sc/funding-accounts/update', {
        id: fundingAccount.id,
        column: key,
        value: value,
      });
    });
  }

  async delete(fundingAccount: FundingAccount) {
    return await getFromCordTables('sc/funding-accounts/delete', {
      id: fundingAccount.id,
    });
  }

  async list(input: FundingAccountListInput) {
    const response = await getFromCordTables('sc/funding-accounts/list', {
      sort: input.sort,
      order: input.order,
      page: input.page,
      resultsPerPage: input.count,
    });
    const fundingAccounts = response.body;
    const iFundingAccounts: TablesFundingAccounts = JSON.parse(fundingAccounts);

    const fundingAccountArray: Array<UnsecuredDto<FundingAccount>> =
      iFundingAccounts.fundingAccounts.map((fundingAccount) => {
        return transformToDto(fundingAccount, FundingAccount.TablesToDto);
      });

    const totalLoaded =
      input.count * (input.page - 1) + fundingAccountArray.length;
    const fundingAccountList: PaginatedListType<UnsecuredDto<FundingAccount>> =
      {
        items: fundingAccountArray,
        total: totalLoaded,
        hasMore: totalLoaded < iFundingAccounts.size,
      };
    return fundingAccountList;
  }
}
