import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyEngagementConnectionResolver } from './ceremony-engagement-connection.resolver';
import { CeremonyMutationActorResolver } from './ceremony-mutation-actor.resolver';
import { CeremonyMutationSubscriptionsResolver } from './ceremony-mutation-subscriptions.resolver';
import { CeremonyUpdatedResolver } from './ceremony-updated.resolver';
import { CeremonyChannels } from './ceremony.channels';
import { CeremonyDrizzleRepository } from './ceremony.drizzle.repository';
import { CeremonyGelRepository } from './ceremony.gel.repository';
import { CeremonyLoader } from './ceremony.loader';
import { CeremonyRepository } from './ceremony.repository';
import { CeremonyResolver } from './ceremony.resolver';
import { CeremonyService } from './ceremony.service';
import * as handlers from './handlers';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    CeremonyResolver,
    CeremonyMutationSubscriptionsResolver,
    CeremonyMutationActorResolver,
    CeremonyEngagementConnectionResolver,
    CeremonyUpdatedResolver,
    CeremonyService,
    CeremonyChannels,
    splitDb(CeremonyRepository, {
      gel: CeremonyGelRepository,
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: CeremonyDrizzleRepository as any,
    }),
    CeremonyLoader,
    ...Object.values(handlers),
  ],
  exports: [CeremonyService],
})
export class CeremonyModule {}
