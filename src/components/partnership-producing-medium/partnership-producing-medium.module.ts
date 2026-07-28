import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PartnershipProducingMediumEngagementConnectionResolver } from './partnership-producing-medium-engagement-connection.resolver';
import { PartnershipProducingMediumDrizzleRepository } from './partnership-producing-medium.drizzle.repository';
import { PartnershipProducingMediumRepository } from './partnership-producing-medium.repository';
import { PartnershipProducingMediumResolver } from './partnership-producing-medium.resolver';
import { PartnershipProducingMediumService } from './partnership-producing-medium.service';
import { UpdatePartnershipProducingMediumOutputResolver } from './update-partnership-producing-medium-output.resolver';

@Module({
  imports: [AuthorizationModule],
  providers: [
    PartnershipProducingMediumResolver,
    UpdatePartnershipProducingMediumOutputResolver,
    PartnershipProducingMediumEngagementConnectionResolver,
    PartnershipProducingMediumService,
    splitDb(PartnershipProducingMediumRepository, {
      // migration-todo: drop the Neo4j path (and this splitDb) at Phase 7 cutover.
      // migration-todo: remove `as any` once splitDb types accept drizzle repos
      // directly — the Neo4j repo's CommonRepository surface is what blocks it.
      postgres: PartnershipProducingMediumDrizzleRepository as any,
    }),
  ],
})
export class PartnershipProducingMediumModule {}
