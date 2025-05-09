import { Injectable } from '@nestjs/common';
import { type PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { FundingAccount } from './dto';
import { type FundingAccountRepository } from './funding-account.repository';

@Injectable()
export class FundingAccountGelRepository
  extends RepoFor(FundingAccount, {
    hydrate: (fa) => fa['*'],
  })
  implements PublicOf<FundingAccountRepository> {}
