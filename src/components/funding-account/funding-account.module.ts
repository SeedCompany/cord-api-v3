import { forwardRef, Module } from '@nestjs/common';
import { PostgresModule } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountRepository } from './funding-account.repository';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), PostgresModule],
  providers: [
    FundingAccountResolver,
    FundingAccountService,
    FundingAccountRepository,
  ],
  exports: [FundingAccountService],
})
export class FundingAccountModule {}
