import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountGelRepository } from './funding-account.gel.repository';
import { FundingAccountLoader } from './funding-account.loader';
import { FundingAccountRepository } from './funding-account.repository';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';
import { FundingAccountAddDeptIdBlockMigration } from './migrations/funding-account-add-dept-id-block.migration';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    FundingAccountResolver,
    FundingAccountService,
    splitDb(FundingAccountRepository, FundingAccountGelRepository),
    FundingAccountLoader,
    FundingAccountAddDeptIdBlockMigration,
  ],
  exports: [FundingAccountService],
})
export class FundingAccountModule {}
