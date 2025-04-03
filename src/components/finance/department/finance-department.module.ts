import { Module } from '@nestjs/common';
import { IdBlockResolver } from './id-block.resolver';

@Module({
  providers: [IdBlockResolver],
})
export class FinanceDepartmentModule {}
