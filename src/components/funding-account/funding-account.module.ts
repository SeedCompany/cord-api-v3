import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [FundingAccountResolver, FundingAccountService],
  exports: [FundingAccountService],
})
export class FundingAccountModule {}
