import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountLoader } from './funding-account.loader';
import { FundingAccountRepository } from './funding-account.repository';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    FundingAccountResolver,
    FundingAccountService,
    FundingAccountRepository,
    FundingAccountLoader,
  ],
  exports: [FundingAccountService],
})
export class FundingAccountModule {}
