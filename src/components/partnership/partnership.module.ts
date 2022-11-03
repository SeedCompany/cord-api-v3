import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { PartnerModule } from '../partner/partner.module';
import { ProjectChangeRequestModule } from '../project-change-request/project-change-request.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import { PartnershipLoader } from './partnership.loader';
import { PartnershipRepository } from './partnership.repository';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => BudgetModule),
    forwardRef(() => EngagementModule),
    FileModule,
    forwardRef(() => LocationModule),
    ProjectChangeRequestModule,
    forwardRef(() => ProjectModule),
    PartnerModule,
  ],
  providers: [
    PartnershipResolver,
    PartnershipService,
    PartnershipRepository,
    PartnershipLoader,
    ...Object.values(handlers),
  ],
  exports: [PartnershipService],
})
export class PartnershipModule {}
