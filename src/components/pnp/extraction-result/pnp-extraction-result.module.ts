import { forwardRef, Module } from '@nestjs/common';
import { ProductModule } from '../../product/product.module';
import { PlanningExtractionResultSaver } from './planning-extraction-result-saver';
import { PnpExtractionResultLanguageEngagementConnectionResolver } from './pnp-extraction-result-language-engagement-connection.resolver';
import { PnpExtractionResultProgressReportConnectionResolver } from './pnp-extraction-result-progress-report-connection.resolver';
import { PnpExtractionResultLoader } from './pnp-extraction-result.loader';
import { PnpExtractionResultRepository } from './pnp-extraction-result.repository';
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
    PnpExtractionResultRepository,
  ],
  exports: [PlanningExtractionResultSaver],
})
export class PnpExtractionResultModule {}
