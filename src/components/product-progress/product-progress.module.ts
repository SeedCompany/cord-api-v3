import { Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProductModule } from '../product/product.module';
import { ProductConnectionResolver } from './product-connection.resolver';
import { ProductProgressRepository } from './product-progress.repository';
import { ProductProgressResolver } from './product-progress.resolver';
import { ProductProgressService } from './product-progress.service';
import { ProgressReportConnectionResolver } from './progress-report-connection.resolver';

@Module({
  imports: [ProductModule, PeriodicReportModule],
  providers: [
    ProgressReportConnectionResolver,
    ProductProgressResolver,
    ProductConnectionResolver,
    ProductProgressService,
    ProductProgressRepository,
  ],
  exports: [ProductProgressService],
})
export class ProductProgressModule {}
