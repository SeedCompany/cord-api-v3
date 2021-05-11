import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';
import { FundingAccountRepository } from './funding-account.repository';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    FundingAccountResolver,
    FundingAccountService,
    FundingAccountRepository,
  ],
  exports: [FundingAccountService, FundingAccountRepository],
})
export class FundingAccountModule {
  
}
