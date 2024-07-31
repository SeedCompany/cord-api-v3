import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { FileModule } from '../file/file.module';
import { PartnerModule } from '../partner/partner.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import { PartnershipByProjectAndPartnerLoader } from './partnership-by-project-and-partner.loader';
import { PartnershipEdgeDBRepository } from './partnership.edgedb.repository';
import { PartnershipLoader } from './partnership.loader';
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
    splitDb(PartnershipRepository, PartnershipEdgeDBRepository),
    PartnershipLoader,
    PartnershipByProjectAndPartnerLoader,
    ...Object.values(handlers),
  ],
  exports: [PartnershipService],
})
export class PartnershipModule {}
