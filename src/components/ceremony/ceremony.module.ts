import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
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
    CeremonyRepository,
    CeremonyLoader,
    ...Object.values(handlers),
  ],
  exports: [CeremonyService],
})
export class CeremonyModule {}
