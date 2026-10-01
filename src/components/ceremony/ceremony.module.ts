import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyEngagementConnectionResolver } from './ceremony-engagement-connection.resolver';
import { CeremonyMutationActorResolver } from './ceremony-mutation-actor.resolver';
import { CeremonyMutationSubscriptionsResolver } from './ceremony-mutation-subscriptions.resolver';
import { CeremonyUpdatedResolver } from './ceremony-updated.resolver';
import { CeremonyChannels } from './ceremony.channels';
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
    CeremonyRepository,
    CeremonyLoader,
    ...Object.values(handlers),
  ],
  exports: [CeremonyService],
})
export class CeremonyModule {}
