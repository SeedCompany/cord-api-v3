import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { FundingAccount } from './dto';
import { FundingAccountRepository } from './funding-account.repository';

@Injectable()
export class FundingAccountGelRepository
  extends RepoFor(FundingAccount, {
    hydrate: (fa) => fa['*'],
  })
  implements PublicOf<FundingAccountRepository> {}
