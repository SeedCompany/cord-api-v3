import { forwardRef, Module } from '@nestjs/common';
import { splitDb2 } from '~/core';
import { ProductModule } from '../../product/product.module';
import { PlanningExtractionResultSaver } from './planning-extraction-result-saver';
import { PnpExtractionResultLanguageEngagementConnectionResolver } from './pnp-extraction-result-language-engagement-connection.resolver';
import { PnpExtractionResultProgressReportConnectionResolver } from './pnp-extraction-result-progress-report-connection.resolver';
import { PnpExtractionResultRepository } from './pnp-extraction-result.edgedb.repository';
import { PnpExtractionResultLoader } from './pnp-extraction-result.loader';
import { PnpExtractionResultNeo4jRepository } from './pnp-extraction-result.neo4j.repository';
import { PnpProblemResolver } from './pnp-problem.resolver';
import { SaveProgressExtractionResultHandler } from './save-progress-extraction-result.handler';

@Module({
  imports: [forwardRef(() => ProductModule)],
  providers: [
    PnpExtractionResultLanguageEngagementConnectionResolver,
    PnpExtractionResultProgressReportConnectionResolver,
    PnpProblemResolver,
    PnpExtractionResultLoader,
    PlanningExtractionResultSaver,
    SaveProgressExtractionResultHandler,
    splitDb2(PnpExtractionResultRepository, {
      edge: PnpExtractionResultRepository,
      neo4j: PnpExtractionResultNeo4jRepository,
    }),
  ],
  exports: [PlanningExtractionResultSaver],
})
export class PnpExtractionResultModule {}
