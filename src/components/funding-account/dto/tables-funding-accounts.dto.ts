/* eslint-disable @typescript-eslint/naming-convention */
export interface TablesFundingAccounts {
  size: number;
  fundingAccounts: TablesFundingAccount[];
}

export interface TablesReadFundingAccount {
  fundingAccount: TablesFundingAccount;
}

export interface TablesFundingAccount {
  name: string;
  account_number: number;
}
