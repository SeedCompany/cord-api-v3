import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountEdgeDBRepository } from './funding-account.edgedb.repository';
import { FundingAccountLoader } from './funding-account.loader';
import { FundingAccountRepository } from './funding-account.repository';
import { FundingAccountResolver } from './funding-account.resolver';
import { FundingAccountService } from './funding-account.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    FundingAccountResolver,
    FundingAccountService,
    splitDb(FundingAccountRepository, FundingAccountEdgeDBRepository),
    FundingAccountLoader,
  ],
  exports: [FundingAccountService],
})
export class FundingAccountModule {}
