import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyEdgeDBRepository } from './ceremony.edgedb.repository';
import { CeremonyLoader } from './ceremony.loader';
import { CeremonyRepository } from './ceremony.repository';
import { CeremonyResolver } from './ceremony.resolver';
import { CeremonyService } from './ceremony.service';
import * as handlers from './handlers';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    CeremonyResolver,
    CeremonyService,
    splitDb(CeremonyRepository, CeremonyEdgeDBRepository),
    CeremonyLoader,
    ...Object.values(handlers),
  ],
  exports: [CeremonyService],
})
export class CeremonyModule {}
