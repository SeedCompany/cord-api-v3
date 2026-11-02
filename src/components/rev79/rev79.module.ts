import { Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProductProgressModule } from '../product-progress/product-progress.module';
import { ProgressReportModule } from '../progress-report/progress-report.module';
import { ProjectModule } from '../project/project.module';
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
  providers: [Rev79Resolver, Rev79Service, Rev79Repository],
})
export class Rev79Module {}
