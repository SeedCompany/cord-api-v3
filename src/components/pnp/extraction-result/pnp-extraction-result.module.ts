import { Module } from '@nestjs/common';
import { splitDb2 } from '~/core';
import { ProductModule } from '../../product/product.module';
import { PnpExtractionResultProgressReportConnectionResolver } from './pnp-extraction-result-progress-report-connection.resolver';
import { PnpExtractionResultRepository } from './pnp-extraction-result.edgedb.repository';
import { PnpExtractionResultLoader } from './pnp-extraction-result.loader';
import { PnpExtractionResultNeo4jRepository } from './pnp-extraction-result.neo4j.repository';
import { SaveProgressExtractionResultHandler } from './save-progress-extraction-result.handler';

@Module({
  imports: [ProductModule],
  providers: [
    PnpExtractionResultProgressReportConnectionResolver,
    PnpExtractionResultLoader,
    SaveProgressExtractionResultHandler,
    splitDb2(PnpExtractionResultRepository, {
      edge: PnpExtractionResultRepository,
      neo4j: PnpExtractionResultNeo4jRepository,
    }),
  ],
})
export class PnpExtractionResultModule {}
