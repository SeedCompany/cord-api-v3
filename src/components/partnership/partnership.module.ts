import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { FileModule } from '../file/file.module';
import { PartnerModule } from '../partner/partner.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import { PartnershipRepository } from './partnership.repository';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    FileModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => ProjectModule),
    PartnerModule,
  ],
  providers: [
    PartnershipResolver,
    PartnershipService,
    PartnershipRepository,
    ...Object.values(handlers),
  ],
  exports: [PartnershipService],
})
export class PartnershipModule {}
