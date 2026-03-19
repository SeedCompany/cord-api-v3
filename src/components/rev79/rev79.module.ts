import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProductProgressModule } from '../product-progress/product-progress.module';
import { ProgressReportModule } from '../progress-report/progress-report.module';
import { ProjectModule } from '../project/project.module';
import { FixRev79ActiveFlagMigration } from './migrations/fix-rev79-active-flag.migration';
import { Rev79GelRepository } from './rev79.gel.repository';
import { Rev79Repository } from './rev79.repository';
import { Rev79Resolver } from './rev79.resolver';
import { Rev79Service } from './rev79.service';

@Module({
  imports: [
    ProjectModule,
    PeriodicReportModule,
    ProgressReportModule,
    ProductProgressModule,
  ],
  providers: [
    Rev79Resolver,
    Rev79Service,
    splitDb(Rev79Repository, { gel: Rev79GelRepository }),
    FixRev79ActiveFlagMigration,
  ],
})
export class Rev79Module {}
