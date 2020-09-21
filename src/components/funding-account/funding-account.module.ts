import { Module } from '@nestjs/common';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';

@Module({
  providers: [FundingAccountResolver, FundingAccountService],
  exports: [FundingAccountService],
})
export class FundingAccountModule {}
