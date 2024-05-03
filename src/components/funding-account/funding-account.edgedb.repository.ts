import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { FundingAccount } from './dto';
import { FundingAccountRepository } from './funding-account.repository';

@Injectable()
export class FundingAccountEdgeDBRepository
  extends RepoFor(FundingAccount, {
    hydrate: (fa) => fa['*'],
  })
  implements PublicOf<FundingAccountRepository> {}
