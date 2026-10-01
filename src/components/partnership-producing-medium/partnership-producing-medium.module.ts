import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PartnershipProducingMediumEngagementConnectionResolver } from './partnership-producing-medium-engagement-connection.resolver';
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
    PartnershipProducingMediumRepository,
  ],
})
export class PartnershipProducingMediumModule {}
