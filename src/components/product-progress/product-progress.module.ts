import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProductModule } from '../product/product.module';
import * as handlers from './handlers';
import { ProductConnectionResolver } from './product-connection.resolver';
import { ProductProgressByProductLoader } from './product-progress-by-product.loader';
import { ProductProgressByReportLoader } from './product-progress-by-report.loader';
import { ProductProgressRepository } from './product-progress.repository';
import { ProductProgressResolver } from './product-progress.resolver';
import { ProductProgressService } from './product-progress.service';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';
import { StepProgressExtractor } from './step-progress-extractor.service';
import { StepProgressResolver } from './step-progress.resolver';

@Module({
  imports: [ProductModule, PeriodicReportModule, AuthorizationModule],
  providers: [
    ProgressReportConnectionResolver,
    ProductProgressResolver,
    StepProgressResolver,
    ProductConnectionResolver,
    ProductProgressByProductLoader,
    ProductProgressByReportLoader,
    ProductProgressService,
    ProductProgressRepository,
    StepProgressExtractor,
    ...Object.values(handlers),
  ],
  exports: [ProductProgressService],
})
export class ProductProgressModule {}
